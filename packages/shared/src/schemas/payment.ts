import { z } from 'zod'

export const chargeSchema = z.object({
  memberId: z.string().uuid(),
  planId: z.string().uuid(),
  currency: z.literal('MXN'),
  method: z.enum(['cash', 'card', 'transfer']),
})

export type ChargeInput = z.infer<typeof chargeSchema>