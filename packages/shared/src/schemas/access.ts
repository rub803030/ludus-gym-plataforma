import { z } from 'zod'

export const qrPayloadSchema = z.object({
  memberId: z.string().uuid(),
  bucket: z.number().int(),
  nonce: z.string().min(8).max(64),
  signature: z.string().length(64),
})

export type QrPayload = z.infer<typeof qrPayloadSchema>