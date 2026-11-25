import { describe, expect, it } from 'vitest'
import { joinGymSchema, registerGymSchema, registerMemberSchema, verifyGymSchema } from '../src/index.js'

describe('esquemas multi-tenant', () => {
  it('registra un gimnasio con valores por defecto', () => {
    const parsed = registerGymSchema.parse({
      gymName: 'GYM Norte',
      ownerName: 'Ana López',
      email: 'ana@example.com',
      password: 'ClaveSegura2026!',
    })
    expect(parsed.currency).toBe('MXN')
    expect(parsed.timezone).toBe('America/Mexico_City')
    expect(parsed.capacity).toBeGreaterThan(0)
  })

  it('rechaza un slug inválido', () => {
    const result = registerGymSchema.safeParse({
      gymName: 'GYM Norte',
      slug: 'GYM Norte!',
      ownerName: 'Ana López',
      email: 'ana@example.com',
      password: 'ClaveSegura2026!',
    })
    expect(result.success).toBe(false)
  })

  it('acepta código corto y QR estático como código de vinculación', () => {
    expect(joinGymSchema.parse({ code: 'LUDUS-A7K2' }).code).toBe('LUDUS-A7K2')
    expect(joinGymSchema.parse({ code: 'abcd' }).code).toBe('abcd')
  })

  it('valida el token de verificación del gimnasio', () => {
    expect(verifyGymSchema.safeParse({ token: 'abc' }).success).toBe(false)
    expect(verifyGymSchema.safeParse({ token: 'x'.repeat(43) }).success).toBe(true)
  })

  it('permite registrar un socio sin datos de gimnasio', () => {
    const parsed = registerMemberSchema.parse({
      firstName: 'Luis',
      lastName: 'Pérez',
      email: 'luis@example.com',
      password: 'ClaveSegura2026!',
    })
    expect(parsed.phone).toBeUndefined()
    expect(parsed.documentNumber).toBeUndefined()
  })
})
