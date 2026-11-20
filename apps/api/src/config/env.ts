import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  REDIS_URL: z.preprocess((value) => (value === '' ? undefined : value), z.string().url().optional()),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  QR_HMAC_SECRET: z.string().min(32),
  FIELD_ENCRYPTION_KEY: z.string().startsWith('base64:'),
  CSRF_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('ludus-gym'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RESEND_API_KEY: z.string().min(1).default(''),
  EMAIL_FROM: z.string().min(3).default('Ludus GYM <onboarding@resend.dev>'),
  // Solo desarrollo: onboarding@resend.dev entrega únicamente al correo dueño de la cuenta.
  RESEND_TEST_RECIPIENT: z.string().email().optional(),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().positive().default(30),
}).superRefine((value, ctx) => {
  const encryptionKey = Buffer.from(value.FIELD_ENCRYPTION_KEY.replace(/^base64:/, ''), 'base64')
  if (encryptionKey.length !== 32) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['FIELD_ENCRYPTION_KEY'], message: 'Debe contener exactamente 32 bytes en base64' })
  }
  if (value.NODE_ENV !== 'production') return

  const origin = new URL(value.CORS_ORIGIN)
  if (origin.protocol !== 'https:') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CORS_ORIGIN'], message: 'CORS_ORIGIN debe usar HTTPS en producción' })
  }
  if (['localhost', '127.0.0.1', '::1'].includes(origin.hostname)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CORS_ORIGIN'], message: 'CORS_ORIGIN no puede ser localhost en producción' })
  }
  if (!value.DIRECT_URL) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DIRECT_URL'], message: 'DIRECT_URL es obligatorio en producción para migraciones' })
  }
  if (!value.RESEND_API_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['RESEND_API_KEY'], message: 'RESEND_API_KEY es obligatorio en producción' })
  }
  const appUrl = new URL(value.WEB_APP_URL)
  if (appUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(appUrl.hostname)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['WEB_APP_URL'], message: 'WEB_APP_URL debe ser HTTPS público en producción' })
  }
})

export type Env = z.infer<typeof envSchema>

let dotenvLoaded = false

/**
 * Carga `.env.local` del monorepo sin dependencias externas. No sobrescribe
 * variables que el proceso ya definió (los tests pueden inyectar las suyas).
 */
export function loadLocalEnv(): void {
  if (dotenvLoaded) return
  dotenvLoaded = true

  const candidates = [
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '..', '.env.local'),
    resolve(process.cwd(), '..', '..', '.env.local'),
    fileURLToPath(new URL('../../../../.env.local', import.meta.url)),
  ]

  for (const file of candidates) {
    if (!existsSync(file)) continue
    const content = readFileSync(file, 'utf8')
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const separator = line.indexOf('=')
      if (separator < 0) continue
      const key = line.slice(0, separator).trim()
      let value = line.slice(separator + 1).trim()
      if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
    break
  }
}

loadLocalEnv()

let cachedEnv: Env | undefined

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Configuración inválida: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`)
  }
  cachedEnv = parsed.data
  return cachedEnv
}

export function resetEnvCache(): void {
  cachedEnv = undefined
}
