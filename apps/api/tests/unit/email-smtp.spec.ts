import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env, SmtpAccount } from '../../src/config/env.js'
import { sendVerificationEmail } from '../../src/shared/email.js'

const { sendMail, createTransport, fetchMock, upsert, updateMany } = vi.hoisted(() => ({
  sendMail: vi.fn(async () => ({ messageId: 'smtp-message-id' })),
  createTransport: vi.fn(() => ({ sendMail })),
  fetchMock: vi.fn(async () => ({ ok: true, json: async () => ({ id: 'resend-id' }) })),
  upsert: vi.fn(async () => undefined),
  updateMany: vi.fn(async () => ({ count: 1 })),
}))

vi.mock('nodemailer', () => ({ default: { createTransport } }))
vi.mock('../../src/shared/database/prisma.js', () => ({
  prisma: { emailSendQuota: { upsert, updateMany } },
}))
vi.mock('../../src/config/env.js', () => ({
  loadEnv: vi.fn(),
  getSmtpAccounts: vi.fn(() => []),
}))

const { loadEnv, getSmtpAccounts } = await import('../../src/config/env.js')

const input = {
  to: 'socio@example.com',
  name: 'Socio',
  link: 'https://ludus-gym-plataforma.vercel.app/verify-email?token=abc',
  platform: 'mobile' as const,
}

function configure(overrides: Partial<Env> = {}): void {
  vi.mocked(loadEnv).mockReturnValue({
    NODE_ENV: 'production',
    RESEND_API_KEY: 'clave-de-prueba-no-real',
    EMAIL_FROM: 'Ludus GYM <verificacion@example.com>',
    EMAIL_VERIFICATION_TTL_MINUTES: 30,
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: 'verificacion@example.com',
    SMTP_PASSWORD: 'clave-de-aplicacion',
    SMTP_ACCOUNTS: '',
    SMTP_DAILY_LIMIT: 300,
    RESEND_TEST_RECIPIENT: 'dueno@example.com',
    ...overrides,
  } as Env)
}

function rotating(users: string[]): SmtpAccount[] {
  return users.map((user) => ({ user, password: 'clave-de-aplicacion' }))
}

beforeEach(() => {
  sendMail.mockReset().mockResolvedValue({ messageId: 'smtp-message-id' })
  createTransport.mockReset().mockImplementation(() => ({ sendMail }))
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ id: 'resend-id' }) })
  upsert.mockReset().mockResolvedValue(undefined)
  updateMany.mockReset().mockResolvedValue({ count: 1 })
  vi.mocked(getSmtpAccounts).mockReset().mockReturnValue([])
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('entrega por SMTP propio', () => {
  it('envía al socio real aunque exista una bandeja de prueba', async () => {
    configure()
    const result = await sendVerificationEmail(input)

    expect(result).toEqual({ id: 'smtp-message-id', skipped: false })
    expect(sendMail).toHaveBeenCalledTimes(1)
    const message = sendMail.mock.calls[0]?.[0] as { to: string; from: string; text: string; html: string }
    expect(message.to).toBe('socio@example.com')
    expect(message.from).toBe('Ludus GYM <verificacion@example.com>')
    expect(message.text).not.toContain('Entrega de prueba')
    expect(message.html).not.toContain('Entrega de prueba')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sin SMTP conserva el envío por Resend', async () => {
    configure({ SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '' })

    await sendVerificationEmail(input)

    expect(sendMail).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rota a la segunda cuenta cuando la primera agotó el cupo', async () => {
    configure()
    vi.mocked(getSmtpAccounts).mockReturnValue(rotating(['cuenta1@gmail.com', 'cuenta2@gmail.com']))
    updateMany.mockImplementation(async ({ where }: { where: { account: string } }) => ({
      count: where.account === 'cuenta1@gmail.com' ? 0 : 1,
    }))

    const result = await sendVerificationEmail(input)

    expect(result.skipped).toBe(false)
    const options = createTransport.mock.calls[0]?.[0] as { auth: { user: string } }
    expect(options.auth.user).toBe('cuenta2@gmail.com')
    const message = sendMail.mock.calls[0]?.[0] as { from: string }
    expect(message.from).toBe('Ludus GYM <cuenta2@gmail.com>')
  })

  it('falla con claridad si todas las cuentas agotaron el cupo', async () => {
    configure({ EMAIL_FROM: 'Ludus GYM <onboarding@resend.dev>' })
    vi.mocked(getSmtpAccounts).mockReturnValue(rotating(['cuenta1@gmail.com', 'cuenta2@gmail.com']))
    updateMany.mockResolvedValue({ count: 0 })

    await expect(sendVerificationEmail(input)).rejects.toThrow('Todas las cuentas SMTP alcanzaron el cupo diario')
    expect(sendMail).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('devuelve el cupo y evita la cuenta fallida en el siguiente intento', async () => {
    configure()
    vi.mocked(getSmtpAccounts).mockReturnValue(rotating(['cuenta1@gmail.com', 'cuenta2@gmail.com']))
    sendMail.mockRejectedValueOnce(new Error('SMTP 535'))

    await expect(sendVerificationEmail(input)).rejects.toThrow('SMTP rechazó el envío')
    expect(updateMany).toHaveBeenCalledWith({
      where: { account: 'cuenta1@gmail.com', day: expect.any(Date), sentCount: { gt: 0 } },
      data: { sentCount: { decrement: 1 } },
    })

    await expect(sendVerificationEmail(input)).resolves.toEqual({ id: 'smtp-message-id', skipped: false })
    const options = createTransport.mock.calls[1]?.[0] as { auth: { user: string } }
    expect(options.auth.user).toBe('cuenta2@gmail.com')
  })
})
