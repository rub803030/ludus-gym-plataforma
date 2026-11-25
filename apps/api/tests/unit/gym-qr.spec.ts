import { beforeAll, describe, expect, it } from 'vitest'
import { generatePublicCode, issueEnrollmentQr, verifyEnrollmentQr } from '../../src/shared/gym-qr.js'

const GYM = '00000000-0000-7000-8000-000000000001'

beforeAll(() => {
  process.env.QR_HMAC_SECRET = 'clave-de-prueba-para-qr-hmac-sha256-1234'
})

describe('QR estático de afiliación', () => {
  it('es estable y resoluble para el mismo gimnasio', () => {
    const token = issueEnrollmentQr(GYM, 'LUDUS-A7K2')
    expect(token).toBe(issueEnrollmentQr(GYM, 'LUDUS-A7K2'))
    expect(verifyEnrollmentQr(token)).toEqual({ gymId: GYM, code: 'LUDUS-A7K2' })
  })

  it('rechaza un código manipulado', () => {
    const token = issueEnrollmentQr(GYM, 'LUDUS-A7K2')
    const raw = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as Record<string, unknown>
    raw['gymId'] = '00000000-0000-7000-8000-000000000002'
    const tampered = Buffer.from(JSON.stringify(raw)).toString('base64url')
    expect(() => verifyEnrollmentQr(tampered)).toThrow('Firma del código de gimnasio inválida')
  })

  it('rechaza un pase de acceso como código de afiliación', () => {
    expect(() => verifyEnrollmentQr(Buffer.from(JSON.stringify({ memberId: GYM })).toString('base64url'))).toThrow('Código de gimnasio inválido')
  })

  it('genera códigos públicos legibles', () => {
    expect(generatePublicCode()).toMatch(/^LUDUS-[A-HJ-NP-Z2-9]{4}$/)
  })
})
