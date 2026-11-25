import { createHash, randomBytes } from 'node:crypto'
import { loadEnv } from '../../config/env.js'
import { prisma } from '../../shared/database/prisma.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { sendVerificationEmail } from '../../shared/email.js'
import { generatePublicCode, issueEnrollmentQr } from '../../shared/gym-qr.js'
import { writeAudit } from '../../shared/audit.js'
import type { VerificationIssue } from '../auth/email-verification.js'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function issueGymVerification(input: {
  gymId: string
  email: string
  ownerName: string
}): Promise<VerificationIssue> {
  const env = loadEnv()
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_MINUTES * 60_000)
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

async function nextPublicCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generatePublicCode()
    const existing = await prisma.gym.findFirst({ where: { publicCode: code } })
    if (!existing) return code
  }
  throw new DomainError('CONFLICT', 'No se pudo generar el código público del gimnasio', 409)
}

/** Activa el gimnasio y emite su credencial estática de afiliación. */
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

  const publicCode = gym.publicCode ?? (await nextPublicCode())
  const enrollmentQrToken = issueEnrollmentQr(gym.id, publicCode)
  const activated = await prisma.gym.update({
    where: { id: gym.id },
    data: {
      status: 'ACTIVE',
      publicCode,
      enrollmentQrToken,
      verificationTokenHash: null,
      verificationExpiresAt: null,
    },
  })
  await prisma.staffUser.updateMany({
    where: { gymId: gym.id, role: 'OWNER' },
    data: { emailVerified: true, emailVerifiedAt: new Date() },
  })
  await writeAudit({
    gymId: gym.id,
    actorRole: 'OWNER',
    action: 'gym.verify',
    entity: 'gym',
    entityId: gym.id,
    after: { status: activated.status, publicCode },
  })
  return activated
}
