import { describe, expect, it } from 'vitest'
import { envSchema } from '../../src/config/env.js'

function productionEnv(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/ludus',
    DIRECT_URL: 'postgresql://user:pass@localhost:5432/ludus',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    QR_HMAC_SECRET: 'c'.repeat(32),
    FIELD_ENCRYPTION_KEY: `base64:${Buffer.alloc(32, 1).toString('base64')}`,
    CSRF_SECRET: 'd'.repeat(32),
    CORS_ORIGIN: 'https://ludus.example.com',
    WEB_APP_URL: 'https://ludus.example.com',
    S3_ENDPOINT: 'https://s3.example.com',
    S3_ACCESS_KEY: 'access-key',
    S3_SECRET_KEY: 'secret-key',
    RESEND_API_KEY: 'test-key',
    ...overrides,
  }
}

describe('validación de seguridad de entorno en producción', () => {
  it('acepta credenciales S3 configuradas y distintas', () => {
    expect(envSchema.safeParse(productionEnv()).success).toBe(true)
  })

  it('rechaza claves S3 iguales', () => {
    const parsed = envSchema.safeParse(productionEnv({ S3_SECRET_KEY: 'access-key' }))
    expect(parsed.success).toBe(false)
  })

  it('rechaza credenciales S3 por defecto', () => {
    const parsed = envSchema.safeParse(productionEnv({ S3_ACCESS_KEY: 'minioadmin' }))
    expect(parsed.success).toBe(false)
  })

  it('rechaza endpoint S3 sin HTTPS', () => {
    const parsed = envSchema.safeParse(productionEnv({ S3_ENDPOINT: 'http://s3.example.com' }))
    expect(parsed.success).toBe(false)
  })
})
