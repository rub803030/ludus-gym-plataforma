import { createHash, randomBytes } from 'node:crypto'
import { loadEnv } from '../../config/env.js'
import { prisma } from '../../shared/database/prisma.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import {
  sendGymActivatedEmail,
  sendGymApprovalEmail,
  sendVerificationEmail,
} from '../../shared/email.js'
import { generatePublicCode, issueEnrollmentQr } from '../../shared/gym-qr.js'
import { writeAudit } from '../../shared/audit.js'
import type { VerificationIssue } from '../auth/email-verification.js'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function expiry(): Date {
  return new Date(Date.now() + loadEnv().EMAIL_VERIFICATION_TTL_MINUTES * 60_000)
}

/** Confirmación de la cuenta OWNER. No activa el gimnasio: falta la autorización global. */
export async function issueGymVerification(input: {
  gymId: string
  email: string
  ownerName: string
}): Promise<VerificationIssue> {
  const env = loadEnv()
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const expiresAt = expiry()
  const link = `${env.WEB_APP_URL.replace(/\/+$/, '')}/verify-gym?token=${encodeURIComponent(token)}`

  await prisma.gym.update({
    where: { id: input.gymId },
    data: {
      verificationTokenHash: tokenHash,
      verificationExpiresAt: expiresAt,
      verificationSentAt: new Date(),
    },
  })
  try {
    await sendVerificationEmail({ to: input.email, name: input.ownerName, link, platform: 'web' })
  } catch (error) {
    await prisma.gym.update({
      where: { id: input.gymId },
      data: { verificationTokenHash: null, verificationExpiresAt: null },
    })
    throw error
  }
  return { token, link, email: input.email, expiresAt: expiresAt.toISOString() }
}

/** Confirma el correo del dueño; el gimnasio sigue PENDING_VERIFICATION. */
export async function verifyGymToken(token: string) {
  const gym = await prisma.gym.findFirst({
    where: { verificationTokenHash: hashToken(token), deletedAt: null },
  })
  if (!gym) {
    throw new DomainError('VERIFICATION_TOKEN_INVALID', 'El enlace no es válido o ya fue usado', 400)
  }
  if (!gym.verificationExpiresAt || gym.verificationExpiresAt < new Date()) {
    throw new DomainError('VERIFICATION_TOKEN_EXPIRED', 'El enlace venció. Solicita uno nuevo', 410)
  }

  const confirmed = await prisma.gym.update({
    where: { id: gym.id },
    data: { verificationTokenHash: null, verificationExpiresAt: null },
  })
  await prisma.staffUser.updateMany({
    where: { gymId: gym.id, role: 'OWNER' },
    data: { emailVerified: true, emailVerifiedAt: new Date() },
  })
  await writeAudit({
    gymId: gym.id,
    actorRole: 'OWNER',
    action: 'gym.email.verify',
    entity: 'gym',
    entityId: gym.id,
  })
  return confirmed
}

async function nextPublicCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generatePublicCode()
    const existing = await prisma.gym.findFirst({ where: { publicCode: code } })
    if (!existing) return code
  }
  throw new DomainError('CONFLICT', 'No se pudo generar el código público del gimnasio', 409)
}

async function adminRecipients(): Promise<Array<{ email: string; name: string }>> {
  const admins = await prisma.staffUser.findMany({
    where: { role: 'ADMIN', isActive: true, deletedAt: null },
    select: { email: true, fullName: true },
  })
  const configured = loadEnv().ADMIN_APPROVAL_EMAILS.split(',')
    .map((email) => email.trim())
    .filter((email) => email.includes('@'))

  const byEmail = new Map<string, { email: string; name: string }>()
  for (const admin of admins) {
    const email = admin.email.trim().toLowerCase()
    if (email) byEmail.set(email, { email, name: admin.fullName })
  }
  for (const email of configured) {
    const key = email.toLowerCase()
    if (!byEmail.has(key)) byEmail.set(key, { email: key, name: 'Administrador' })
  }
  return [...byEmail.values()]
}

/** Envía a los ADMIN un enlace de un solo uso para autorizar el alta. */
export async function issueGymApproval(gymId: string, gymName: string): Promise<VerificationIssue> {
  const env = loadEnv()
  const recipients = await adminRecipients()
  if (recipients.length === 0 && env.NODE_ENV === 'production') {
    throw new DomainError('ADMIN_NOT_CONFIGURED', 'No hay administradores configurados para autorizar gimnasios', 503)
  }

  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const expiresAt = expiry()
  const link = `${env.WEB_APP_URL.replace(/\/+$/, '')}/approve-gym?token=${encodeURIComponent(token)}`

  await prisma.gym.update({
    where: { id: gymId },
    data: {
      approvalTokenHash: tokenHash,
      approvalExpiresAt: expiresAt,
      approvalSentAt: new Date(),
    },
  })

  if (recipients.length > 0) {
    try {
      await Promise.all(recipients.map((recipient) => sendGymApprovalEmail({
        to: recipient.email,
        name: recipient.name,
        gymName,
        link,
      })))
    } catch (error) {
      await prisma.gym.update({
        where: { id: gymId },
        data: { approvalTokenHash: null, approvalExpiresAt: null },
      })
      throw error
    }
  }

  return {
    token,
    link,
    email: recipients.map((recipient) => recipient.email).join(', '),
    expiresAt: expiresAt.toISOString(),
  }
}

/** Activa el gimnasio y emite su credencial estática de afiliación. */
export async function approveGym(token: string, actorId: string) {
  const tokenHash = hashToken(token)
  const now = new Date()
  const gym = await prisma.gym.findFirst({
    where: { approvalTokenHash: tokenHash, deletedAt: null },
  })
  if (!gym || gym.status !== 'PENDING_VERIFICATION') {
    throw new DomainError('VERIFICATION_TOKEN_INVALID', 'El enlace no es válido o ya fue usado', 400)
  }
  if (!gym.approvalExpiresAt || gym.approvalExpiresAt <= now) {
    throw new DomainError('VERIFICATION_TOKEN_EXPIRED', 'El enlace venció. Solicita uno nuevo', 410)
  }

  const owner = await prisma.staffUser.findFirst({
    where: { gymId: gym.id, role: 'OWNER', deletedAt: null },
    select: { id: true, email: true, fullName: true, emailVerified: true },
  })
  if (!owner?.emailVerified) {
    throw new DomainError('OWNER_EMAIL_NOT_VERIFIED', 'El propietario debe confirmar su correo antes de autorizar el gimnasio', 409)
  }

  const publicCode = gym.publicCode ?? (await nextPublicCode())
  const enrollmentQrToken = issueEnrollmentQr(gym.id, publicCode)
  const activation = await prisma.gym.updateMany({
    where: {
      id: gym.id,
      status: 'PENDING_VERIFICATION',
      approvalTokenHash: tokenHash,
      approvalExpiresAt: { gt: now },
      deletedAt: null,
    },
    data: {
      status: 'ACTIVE',
      publicCode,
      enrollmentQrToken,
      approvedAt: now,
      approvalTokenHash: null,
      approvalExpiresAt: null,
      verificationTokenHash: null,
      verificationExpiresAt: null,
    },
  })
  if (activation.count !== 1) {
    throw new DomainError('VERIFICATION_TOKEN_INVALID', 'El enlace no es válido o ya fue usado', 409)
  }
  const activated = await prisma.gym.findUniqueOrThrow({ where: { id: gym.id } })
  await writeAudit({
    gymId: gym.id,
    actorId,
    actorRole: 'ADMIN',
    action: 'gym.approve',
    entity: 'gym',
    entityId: gym.id,
    after: { status: activated.status, publicCode },
  })

  const recipient = gym.contactEmail ?? owner.email
  if (recipient) {
    try {
      await sendGymActivatedEmail({
        to: recipient,
        name: owner?.fullName ?? gym.name,
        gymName: gym.name,
        link: `${envBase()}/login`,
      })
    } catch {
      // La autorización ya se completó; el aviso no debe revertirla.
    }
  }
  return activated
}

function envBase(): string {
  return loadEnv().WEB_APP_URL.replace(/\/+$/, '')
}
