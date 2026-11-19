import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const BUCKET_MS = 30_000
const OFFLINE_TTL_MS = 10 * 60 * 1000

const qrSchema = z.object({
  memberId: z.string().uuid(),
  bucket: z.number().int(),
  exp: z.number().int(),
  nonce: z.string().min(8),
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

export function issueQr(memberId: string): { token: string; bucket: number; expiresAt: string } {
  const bucket = currentBucket()
  const exp = (bucket + 1) * BUCKET_MS
  const nonce = randomBytes(12).toString('hex')
  const base = `${memberId}.${bucket}.${exp}.${nonce}`
  const payload: QrPayload = { memberId, bucket, exp, nonce, signature: sign(base) }
  return {
    token: Buffer.from(JSON.stringify(payload)).toString('base64url'),
    bucket,
    expiresAt: new Date(exp).toISOString(),
  }
}

export function issueOfflineCredential(memberId: string): string {
  const exp = Date.now() + OFFLINE_TTL_MS
  const nonce = randomBytes(12).toString('hex')
  const base = `offline.${memberId}.${exp}.${nonce}`
  return Buffer.from(
    JSON.stringify({ memberId, exp, nonce, kind: 'offline', signature: sign(base) }),
  ).toString('base64url')
}

export function verifyQr(token: string): { memberId: string; bucket: number; offline: boolean } {
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))
  } catch {
    throw new Error('QR inválido')
  }
  const obj = raw as Record<string, unknown>
  if (obj['kind'] === 'offline') {
    const exp = Number(obj['exp'])
    const memberId = String(obj['memberId'])
    const nonce = String(obj['nonce'])
    const expected = sign(`offline.${memberId}.${exp}.${nonce}`)
    if (exp < Date.now() || !safeEqual(expected, String(obj['signature']))) {
      throw new Error('Credencial offline expirada')
    }
    return { memberId, bucket: Math.floor(exp / BUCKET_MS), offline: true }
  }
  const parsed = qrSchema.safeParse(obj)
  if (!parsed.success) throw new Error('QR inválido')
  const { memberId, bucket, exp, nonce, signature } = parsed.data
  if (exp < Date.now()) throw new Error('QR expirado')
  const expected = sign(`${memberId}.${bucket}.${exp}.${nonce}`)
  if (!safeEqual(expected, signature)) throw new Error('Firma QR inválida')
  return { memberId, bucket, offline: false }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
