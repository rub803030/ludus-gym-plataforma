import { z } from 'zod'

export const chargeSchema = z.object({
  memberId: z.string().uuid(),
  planId: z.string().uuid(),
  // La API trabaja en pesos MXN en el contrato; internamente se guardan centavos.
  amount: z
    .number()
    .positive()
    .max(1000000)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
      message: 'El importe debe tener máximo dos decimales',
    }),
  currency: z.literal('MXN'),
  method: z.enum(['cash', 'card', 'transfer']),
  idempotencyKey: z.string().min(16).max(128),
})

export type ChargeInput = z.infer<typeof chargeSchema>