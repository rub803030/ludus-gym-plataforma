import { beforeAll, describe, expect, it } from 'vitest'
import { issueQr, issueOfflineCredential, verifyQr } from '../../src/shared/qr.js'

const MEMBER = '00000000-0000-7000-8000-000000000101'
const GYM_A = '00000000-0000-7000-8000-000000000001'
const GYM_B = '00000000-0000-7000-8000-000000000002'

beforeAll(() => {
  process.env.QR_HMAC_SECRET = 'clave-de-prueba-para-qr-hmac-sha256-1234'
})

describe('QR de acceso multi-tenant', () => {
  it('incluye y valida gymId en el pase dinámico', () => {
    const qr = issueQr(MEMBER, GYM_A)
    const decoded = verifyQr(qr.token)
    expect(decoded.memberId).toBe(MEMBER)
    expect(decoded.gymId).toBe(GYM_A)
    expect(decoded.bucket).toBe(qr.bucket)
    expect(decoded.offline).toBe(false)
  })

  it('incluye y valida gymId en la credencial offline', () => {
    const token = issueOfflineCredential(MEMBER, GYM_B)
    const decoded = verifyQr(token)
    expect(decoded.gymId).toBe(GYM_B)
    expect(decoded.offline).toBe(true)
  })

  it('rechaza un payload manipulado para cambiar el gimnasio', () => {
    const qr = issueQr(MEMBER, GYM_A)
    const raw = JSON.parse(Buffer.from(qr.token, 'base64url').toString('utf8')) as Record<string, unknown>
    raw['gymId'] = GYM_B
    const tampered = Buffer.from(JSON.stringify(raw)).toString('base64url')
    expect(() => verifyQr(tampered)).toThrow('Firma QR inválida')
  })

  it('rechaza un pase sin gymId', () => {
    const qr = issueQr(MEMBER, GYM_A)
    const raw = JSON.parse(Buffer.from(qr.token, 'base64url').toString('utf8')) as Record<string, unknown>
    delete raw['gymId']
    const legacy = Buffer.from(JSON.stringify(raw)).toString('base64url')
    expect(() => verifyQr(legacy)).toThrow('QR inválido')
  })
})
