import { describe, expect, it } from 'vitest'
import { approveGymSchema, joinGymSchema, registerGymSchema, registerMemberSchema, verifyGymSchema } from '../src/index.js'

const gymRegistration = {
  gymName: 'GYM Norte',
  ownerName: 'Ana López',
  email: 'ana@example.com',
  password: 'ClaveSegura2026!',
  contactEmail: 'contacto@gymnorte.com',
  phone: '5512345678',
  address: 'Av. Insurgentes 123, Roma Norte',
  city: 'Ciudad de México',
  state: 'CDMX',
  postalCode: '06700',
  legalRepresentative: 'Ana López',
  rfc: 'LOPE900101ABC',
}

describe('esquemas multi-tenant', () => {
  it('registra un gimnasio con valores por defecto', () => {
    const parsed = registerGymSchema.parse(gymRegistration)
    expect(parsed.currency).toBe('MXN')
    expect(parsed.timezone).toBe('America/Mexico_City')
    expect(parsed.capacity).toBeGreaterThan(0)
    expect(parsed.branchCount).toBe(1)
    expect(parsed.rfc).toBe('LOPE900101ABC')
  })

  it('exige ubicación, contacto, representante legal y RFC', () => {
    const result = registerGymSchema.safeParse({
      gymName: 'GYM Norte',
      ownerName: 'Ana López',
      email: 'ana@example.com',
      password: 'ClaveSegura2026!',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0])
      expect(paths).toEqual(expect.arrayContaining([
        'contactEmail', 'phone', 'address', 'city', 'state', 'postalCode', 'legalRepresentative', 'rfc',
      ]))
    }
  })

  it('rechaza un slug inválido', () => {
    const result = registerGymSchema.safeParse({
      ...gymRegistration,
      slug: 'GYM Norte!',
    })
    expect(result.success).toBe(false)
  })

  it('acepta código corto y QR estático como código de vinculación', () => {
    expect(joinGymSchema.parse({ code: 'LUDUS-A7K2' }).code).toBe('LUDUS-A7K2')
    expect(joinGymSchema.parse({ code: 'abcd' }).code).toBe('abcd')
  })

  it('valida los tokens de verificación y autorización del gimnasio', () => {
    expect(verifyGymSchema.safeParse({ token: 'abc' }).success).toBe(false)
    expect(verifyGymSchema.safeParse({ token: 'x'.repeat(43) }).success).toBe(true)
    expect(approveGymSchema.safeParse({ token: 'abc' }).success).toBe(false)
    expect(approveGymSchema.safeParse({ token: 'x'.repeat(43) }).success).toBe(true)
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
