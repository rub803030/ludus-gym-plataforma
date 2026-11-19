import { z } from 'zod'

export const chargeSchema = z.object({
  memberId: z.string().uuid(),
  planId: z.string().uuid(),
  amount: z.number().int().positive().max(100000000),
  currency: z.literal('MXN'),
  method: z.enum(['cash', 'card', 'transfer']),
  idempotencyKey: z.string().min(16).max(128),
})

export type ChargeInput = z.infer<typeof chargeSchema>