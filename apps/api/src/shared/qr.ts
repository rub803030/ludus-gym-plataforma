import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const BUCKET_MS = 30_000
const OFFLINE_TTL_MS = 10 * 60 * 1000

const qrSchema = z.object({
  memberId: z.string().uuid(),
  gymId: z.string().uuid(),
  bucket: z.number().int(),
  exp: z.number().int(),
  nonce: z.string().min(8),
  signature: z.string().length(64),
})

const offlineSchema = z.object({
  memberId: z.string().uuid(),
  gymId: z.string().uuid(),
  exp: z.number().int(),
  nonce: z.string().min(8),
  kind: z.literal('offline'),
  signature: z.string().length(64),
})

export type QrPayload = z.infer<typeof qrSchema>

function secret(): string {
  const value = process.env.QR_HMAC_SECRET
  if (!value || value.length < 32) throw new Error('QR_HMAC_SECRET inválido')
  return value
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('hex')
}

export function currentBucket(): number {
  return Math.floor(Date.now() / BUCKET_MS)
}

export function issueQr(memberId: string, gymId: string): { token: string; bucket: number; expiresAt: string; gymId: string } {
  const bucket = currentBucket()
  const exp = (bucket + 1) * BUCKET_MS
  const nonce = randomBytes(12).toString('hex')
  const base = `${memberId}.${gymId}.${bucket}.${exp}.${nonce}`
  const payload: QrPayload = { memberId, gymId, bucket, exp, nonce, signature: sign(base) }
  return {
    token: Buffer.from(JSON.stringify(payload)).toString('base64url'),
    bucket,
    expiresAt: new Date(exp).toISOString(),
    gymId,
  }
}

export function issueOfflineCredential(memberId: string, gymId: string): string {
  const exp = Date.now() + OFFLINE_TTL_MS
  const nonce = randomBytes(12).toString('hex')
  const base = `offline.${memberId}.${gymId}.${exp}.${nonce}`
  const payload = { memberId, gymId, exp, nonce, kind: 'offline' as const, signature: sign(base) }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export interface VerifiedQr {
  memberId: string
  gymId: string
  bucket: number
  offline: boolean
}

export function verifyQr(token: string): VerifiedQr {
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))
  } catch {
    throw new Error('QR inválido')
  }
  const obj = raw as Record<string, unknown>
  if (obj['kind'] === 'offline') {
    const parsed = offlineSchema.safeParse(obj)
    if (!parsed.success) throw new Error('Credencial offline inválida')
    const { memberId, gymId, exp, nonce, signature } = parsed.data
    const expected = sign(`offline.${memberId}.${gymId}.${exp}.${nonce}`)
    if (exp < Date.now() || !safeEqual(expected, signature)) {
      throw new Error('Credencial offline expirada')
    }
    return { memberId, gymId, bucket: Math.floor(exp / BUCKET_MS), offline: true }
  }
  const parsed = qrSchema.safeParse(obj)
  if (!parsed.success) throw new Error('QR inválido')
  const { memberId, gymId, bucket, exp, nonce, signature } = parsed.data
  if (exp < Date.now()) throw new Error('QR expirado')
  const expected = sign(`${memberId}.${gymId}.${bucket}.${exp}.${nonce}`)
  if (!safeEqual(expected, signature)) throw new Error('Firma QR inválida')
  return { memberId, gymId, bucket, offline: false }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
