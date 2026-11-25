import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../../src/config/env.js'
import { sendVerificationEmail } from '../../src/shared/email.js'

vi.mock('../../src/config/env.js', () => ({ loadEnv: vi.fn() }))

const { loadEnv } = await import('../../src/config/env.js')

function configure(overrides: Partial<Env>): void {
  vi.mocked(loadEnv).mockReturnValue({
    NODE_ENV: 'production',
    RESEND_API_KEY: 'clave-de-prueba-no-real',
    EMAIL_FROM: 'Ludus GYM <onboarding@resend.dev>',
    EMAIL_VERIFICATION_TTL_MINUTES: 30,
    RESEND_TEST_RECIPIENT: undefined,
    ...overrides,
  } as Env)
}

function captureFetch(): { mocks: Array<{ to: string[]; subject: string; text: string; html: string }> } {
  const mocks: Array<{ to: string[]; subject: string; text: string; html: string }> = []
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    mocks.push(JSON.parse(String(init.body)) as (typeof mocks)[number])
    return { ok: true, json: async () => ({ id: 'mensaje-de-prueba' }) }
  }))
  return { mocks }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('destinatario del correo de verificación', () => {
  it('en producción entrega al correo real del socio aunque exista una bandeja de prueba', async () => {
    configure({ RESEND_TEST_RECIPIENT: 'dueno@example.com' })
    const { mocks } = captureFetch()

    await sendVerificationEmail({
      to: 'socio@example.com',
      name: 'Socio',
      link: 'https://ludus-gym-plataforma.vercel.app/verify-email?token=abc',
      platform: 'mobile',
    })

    expect(mocks).toHaveLength(1)
    expect(mocks[0]?.to).toEqual(['socio@example.com'])
    expect(mocks[0]?.subject).toContain('socio@example.com')
    expect(mocks[0]?.text).not.toContain('Entrega de prueba')
    expect(mocks[0]?.html).not.toContain('Entrega de prueba')
  })

  it('en desarrollo mantiene la bandeja de prueba e identifica la cuenta real', async () => {
    configure({ NODE_ENV: 'development', RESEND_TEST_RECIPIENT: 'dueno@example.com' })
    const { mocks } = captureFetch()

    await sendVerificationEmail({
      to: 'socio@example.com',
      name: 'Socio',
      link: 'http://localhost:3000/verify-email?token=abc',
      platform: 'mobile',
    })

    expect(mocks[0]?.to).toEqual(['dueno@example.com'])
    expect(mocks[0]?.text).toContain('Cuenta: socio@example.com')
  })

  it('sin bandeja de prueba usa el correo real en cualquier entorno', async () => {
    configure({ NODE_ENV: 'development' })
    const { mocks } = captureFetch()

    await sendVerificationEmail({
      to: 'socio@example.com',
      name: 'Socio',
      link: 'http://localhost:3000/verify-email?token=abc',
      platform: 'web',
    })

    expect(mocks[0]?.to).toEqual(['socio@example.com'])
  })
})
