import { createHash, randomBytes } from 'node:crypto'
import { loadEnv } from '../../config/env.js'
import { prisma } from '../../shared/database/prisma.js'
import { getCache } from '../../shared/redis.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { writeAudit } from '../../shared/audit.js'
import { sendVerificationEmail } from '../../shared/email.js'

type Kind = 'staff' | 'member'
type Platform = 'web' | 'mobile'

export interface VerificationIssue {
  token: string
  link: string
  email: string
  expiresAt: string
}

/** Expone el correo y la vigencia; el token solo se devuelve fuera de producción. */
export function verificationResponse(issued: VerificationIssue): {
  email: string
  expiresAt: string
  devToken?: string
  devLink?: string
} {
  if (process.env.NODE_ENV === 'production') {
    return { email: issued.email, expiresAt: issued.expiresAt }
  }
  return {
    email: issued.email,
    expiresAt: issued.expiresAt,
    devToken: issued.token,
    devLink: issued.link,
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function emailHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

function buildLink(token: string): string {
  const env = loadEnv()
  const base = env.WEB_APP_URL.replace(/\/+$/, '')
  return `${base}/verify-email?token=${encodeURIComponent(token)}`
}

async function markIssued(kind: Kind, id: string, tokenHash: string, expiresAt: Date): Promise<void> {
  const data = {
    verificationTokenHash: tokenHash,
    verificationExpiresAt: expiresAt,
    verificationSentAt: new Date(),
    emailVerified: false,
    emailVerifiedAt: null,
  }
  if (kind === 'staff') {
    await prisma.staffUser.update({ where: { id }, data })
  } else {
    await prisma.member.update({ where: { id }, data })
  }
}

async function clearToken(kind: Kind, id: string): Promise<void> {
  const data = { verificationTokenHash: null, verificationExpiresAt: null }
  if (kind === 'staff') {
    await prisma.staffUser.update({ where: { id }, data })
  } else {
    await prisma.member.update({ where: { id }, data })
  }
}

export async function issueVerification(input: {
  kind: Kind
  id: string
  email: string
  name: string
  platform: Platform
}): Promise<VerificationIssue> {
  const env = loadEnv()
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_MINUTES * 60_000)

  await markIssued(input.kind, input.id, tokenHash, expiresAt)
  const link = buildLink(token)
  try {
    await sendVerificationEmail({ to: input.email, name: input.name, link, platform: input.platform })
  } catch (error) {
    await clearToken(input.kind, input.id)
    throw error
  }
  return { token, link, email: input.email, expiresAt: expiresAt.toISOString() }
}

export async function verifyEmailToken(token: string): Promise<{
  email: string
  platform: Platform
  name: string
  gymId: string
}> {
  const tokenHash = hashToken(token)
  const now = new Date()

  const staff = await prisma.staffUser.findFirst({
    where: { verificationTokenHash: tokenHash, deletedAt: null },
  })
  if (staff) {
    if (!staff.verificationExpiresAt || staff.verificationExpiresAt < now) {
      throw new DomainError('VERIFICATION_TOKEN_EXPIRED', 'El enlace venció. Solicita uno nuevo', 410)
    }
    await prisma.staffUser.update({
      where: { id: staff.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: now,
        verificationTokenHash: null,
        verificationExpiresAt: null,
      },
    })
    await writeAudit({
      gymId: staff.gymId,
      actorId: staff.id,
      actorRole: staff.role,
      action: 'email.verify',
      entity: 'staff',
      entityId: staff.id,
      after: { email: staff.email, verifiedAt: now.toISOString() },
    })
    return { email: staff.email, platform: 'web', name: staff.fullName, gymId: staff.gymId }
  }

  const member = await prisma.member.findFirst({
    where: { verificationTokenHash: tokenHash, deletedAt: null },
  })
  if (member) {
    if (!member.verificationExpiresAt || member.verificationExpiresAt < now) {
      throw new DomainError('VERIFICATION_TOKEN_EXPIRED', 'El enlace venció. Solicita uno nuevo', 410)
    }
    await prisma.member.update({
      where: { id: member.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: now,
        verificationTokenHash: null,
        verificationExpiresAt: null,
      },
    })
    await writeAudit({
      gymId: member.gymId,
      actorId: member.id,
      actorRole: 'MEMBER',
      action: 'email.verify',
      entity: 'member',
      entityId: member.id,
      after: { email: member.email, verifiedAt: now.toISOString() },
    })
    return {
      email: member.email,
      platform: 'mobile',
      name: `${member.firstName} ${member.lastName}`,
      gymId: member.gymId ?? '',
    }
  }

  throw new DomainError('VERIFICATION_TOKEN_INVALID', 'El enlace no es válido o ya fue usado', 400)
}

export async function resendVerification(
  email: string,
  platform: Platform,
): Promise<{ ok: true; devToken?: string; devLink?: string }> {
  const normalized = email.trim().toLowerCase()
  const cooldownKey = `verify:resend:${platform}:${emailHash(normalized)}`
  const allowed = await getCache().set(cooldownKey, '1', 'EX', 60, 'NX')
  if (allowed === null && process.env.NODE_ENV === 'production') {
    throw new DomainError('RATE_LIMITED', 'Espera un minuto antes de solicitar otro correo', 429)
  }

  const normalizedPlatform = platform === 'mobile' ? 'mobile' : 'web'
  if (normalizedPlatform === 'mobile') {
    const member = await prisma.member.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' }, deletedAt: null },
    })
    if (!member) return { ok: true }
    if (member.emailVerified) return { ok: true }
    const issued = await issueVerification({
      kind: 'member',
      id: member.id,
      email: member.email,
      name: `${member.firstName} ${member.lastName}`,
      platform: 'mobile',
    })
    return devResult(issued)
  }

  const staff = await prisma.staffUser.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' }, deletedAt: null },
  })
  if (!staff) return { ok: true }
  if (staff.emailVerified) return { ok: true }
  const issued = await issueVerification({
    kind: 'staff',
    id: staff.id,
    email: staff.email,
    name: staff.fullName,
    platform: 'web',
  })
  return devResult(issued)
}

function devResult(issued: VerificationIssue): { ok: true; devToken?: string; devLink?: string } {
  if (process.env.NODE_ENV === 'production') return { ok: true }
  return { ok: true, devToken: issued.token, devLink: issued.link }
}
