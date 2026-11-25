import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { enrollmentQrPayloadSchema } from '@ludus/shared'

/**
 * QR estático de afiliación. No expira: sirve solo para vincular una cuenta
 * de socio al gimnasio. La firma usa el mismo HMAC-SHA256 que los pases de
 * acceso, con un prefijo distinto para evitar confusiones entre ambos.
 */

function secret(): string {
  const value = process.env.QR_HMAC_SECRET
  if (!value || value.length < 32) throw new Error('QR_HMAC_SECRET inválido')
  return value
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function issueEnrollmentQr(gymId: string, code: string): string {
  const payload = {
    kind: 'gym-enroll' as const,
    gymId,
    code,
    signature: sign(`gym-enroll.${gymId}.${code}`),
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function verifyEnrollmentQr(token: string): { gymId: string; code: string } {
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(token.trim(), 'base64url').toString('utf8'))
  } catch {
    throw new Error('Código de gimnasio inválido')
  }
  const parsed = enrollmentQrPayloadSchema.safeParse(raw)
  if (!parsed.success) throw new Error('Código de gimnasio inválido')
  const { gymId, code, signature } = parsed.data
  if (!safeEqual(sign(`gym-enroll.${gymId}.${code}`), signature)) {
    throw new Error('Firma del código de gimnasio inválida')
  }
  return { gymId, code }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Código público legible, p. ej. LUDUS-A7K2. */
export function generatePublicCode(): string {
  const bytes = randomBytes(4)
  let suffix = ''
  for (const byte of bytes) suffix += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  return `LUDUS-${suffix}`
}
