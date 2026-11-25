import { z } from 'zod'

/** Pase dinámico de 30 s: el gimnasio forma parte del payload firmado. */
export const qrPayloadSchema = z.object({
  memberId: z.string().uuid(),
  gymId: z.string().uuid(),
  bucket: z.number().int(),
  exp: z.number().int(),
  nonce: z.string().min(8).max(64),
  signature: z.string().length(64),
})

/** Credencial offline de 10 min, también vinculada al gimnasio. */
export const offlineQrPayloadSchema = z.object({
  memberId: z.string().uuid(),
  gymId: z.string().uuid(),
  exp: z.number().int(),
  nonce: z.string().min(8).max(64),
  kind: z.literal('offline'),
  signature: z.string().length(64),
})

/** QR estático de afiliación: no otorga acceso físico. */
export const enrollmentQrPayloadSchema = z.object({
  kind: z.literal('gym-enroll'),
  gymId: z.string().uuid(),
  code: z.string().min(4).max(16),
  signature: z.string().length(64),
})

export type QrPayload = z.infer<typeof qrPayloadSchema>
export type OfflineQrPayload = z.infer<typeof offlineQrPayloadSchema>
export type EnrollmentQrPayload = z.infer<typeof enrollmentQrPayloadSchema>
