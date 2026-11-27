import { describe, expect, it } from 'vitest'
import { chargeSchema } from '../src/index.js'

const charge = {
  memberId: '11111111-1111-4111-8111-111111111111',
  planId: '22222222-2222-4222-8222-222222222222',
  amount: 699.5,
  currency: 'MXN' as const,
  method: 'cash' as const,
  idempotencyKey: 'clave-unica-de-idempotencia-2026',
}

describe('contrato de cobro en pesos MXN', () => {
  it('acepta importes con hasta dos decimales', () => {
    expect(chargeSchema.safeParse(charge).success).toBe(true)
  })

  it('rechaza importes con más de dos decimales', () => {
    expect(chargeSchema.safeParse({ ...charge, amount: 699.999 }).success).toBe(false)
  })

  it('rechaza importes iguales o menores a cero', () => {
    expect(chargeSchema.safeParse({ ...charge, amount: 0 }).success).toBe(false)
  })
})
