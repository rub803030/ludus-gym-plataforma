import { describe, expect, it } from 'vitest'
import type { FastifyRequest } from 'fastify'
import { csrfGuard, getCsrfSecret, signCsrf } from '../../src/shared/middleware/csrf.js'

const guard = csrfGuard()

function request(options: {
  method?: string
  url?: string
  headers?: Record<string, string>
  cookies?: Record<string, string>
}): FastifyRequest {
  return {
    method: options.method ?? 'POST',
    url: options.url ?? '/api/payments/charge',
    headers: options.headers ?? {},
    cookies: options.cookies ?? {},
  } as unknown as FastifyRequest
}

describe('protección CSRF', () => {
  it('firma el token de forma determinista', () => {
    expect(signCsrf('secret', 'session')).toBe(signCsrf('secret', 'session'))
    expect(signCsrf('secret', 'session')).not.toBe(signCsrf('secret', 'other'))
  })

  it('rechaza mutaciones web sin token', async () => {
    await expect(
      guard(request({ cookies: { ludus_sid: 'session' } }), {} as never),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('rechaza un token inválido', async () => {
    await expect(
      guard(
        request({
          headers: { 'x-csrf-token': 'invalido' },
          cookies: { ludus_sid: 'session' },
        }),
        {} as never,
      ),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('acepta el token correcto', async () => {
    const sessionId = 'session-valida'
    const token = signCsrf(getCsrfSecret(), sessionId)
    await expect(
      guard(
        request({ headers: { 'x-csrf-token': token }, cookies: { ludus_sid: sessionId } }),
        {} as never,
      ),
    ).resolves.toBeUndefined()
  })

  it('exime a las apps móvil con Bearer', async () => {
    await expect(
      guard(request({ headers: { authorization: 'Bearer token' } }), {} as never),
    ).resolves.toBeUndefined()
  })

  it('exime al endpoint de login', async () => {
    await expect(
      guard(request({ url: '/api/auth/web/login' }), {} as never),
    ).resolves.toBeUndefined()
  })
})
