import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

/** Una cuenta SMTP de la rotación. `from` se deriva de `user` si no se indica. */
export const smtpAccountSchema = z.object({
  user: z.string().email(),
  password: z.string().min(1),
  from: z.string().min(3).optional(),
  host: z.string().min(1).optional(),
  port: z.coerce.number().int().positive().optional(),
  secure: z.boolean().optional(),
})

export type SmtpAccount = z.infer<typeof smtpAccountSchema>

const smtpAccountsSchema = z.array(smtpAccountSchema).min(1)

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
  // SMTP propio: entrega directa al correo real del socio, sin dominio verificado.
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  // Rotación opcional: un solo secreto JSON con cuentas {user,password,from?}.
  SMTP_ACCOUNTS: z.string().default(''),
  SMTP_MAX_ACCOUNTS: z.coerce.number().int().min(1).max(100).default(10),
  SMTP_DAILY_LIMIT: z.coerce.number().int().positive().default(300),
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
  let rotatingAccounts: SmtpAccount[] = []
  if (value.SMTP_ACCOUNTS.trim()) {
    try {
      const parsedAccounts = smtpAccountsSchema.safeParse(JSON.parse(value.SMTP_ACCOUNTS))
      if (parsedAccounts.success) {
        if (parsedAccounts.data.length > value.SMTP_MAX_ACCOUNTS) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['SMTP_ACCOUNTS'],
            message: `SMTP_ACCOUNTS supera el límite de ${value.SMTP_MAX_ACCOUNTS} cuentas; sube SMTP_MAX_ACCOUNTS`,
          })
        } else {
          rotatingAccounts = parsedAccounts.data
        }
      } else {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_ACCOUNTS'],
          message: 'SMTP_ACCOUNTS debe ser un JSON con cuentas {user, password, from?}',
        })
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_ACCOUNTS'],
        message: 'SMTP_ACCOUNTS debe ser un JSON válido',
      })
    }
  }
  const singleSmtpConfigured = Boolean(value.SMTP_HOST.trim() && value.SMTP_USER.trim() && value.SMTP_PASSWORD)
  const smtpConfigured = rotatingAccounts.length > 0 || singleSmtpConfigured
  if (!smtpConfigured && !value.RESEND_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RESEND_API_KEY'],
      message: 'En producción se requiere RESEND_API_KEY, SMTP_HOST + SMTP_USER + SMTP_PASSWORD o SMTP_ACCOUNTS',
    })
  }
  if (rotatingAccounts.length === 0 && singleSmtpConfigured) {
    const fromAddress = (value.EMAIL_FROM.match(/<([^>]+)>/)?.[1] ?? value.EMAIL_FROM).trim().toLowerCase()
    if (fromAddress !== value.SMTP_USER.trim().toLowerCase()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_FROM'],
        message: 'Con un único SMTP, EMAIL_FROM debe usar la misma dirección que SMTP_USER',
      })
    }
  }
  const appUrl = new URL(value.WEB_APP_URL)
  if (appUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(appUrl.hostname)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['WEB_APP_URL'], message: 'WEB_APP_URL debe ser HTTPS público en producción' })
  }
})

export type Env = z.infer<typeof envSchema>

/** Devuelve las cuentas de rotación ya validadas por `loadEnv`. */
export function getSmtpAccounts(env: Env): SmtpAccount[] {
  if (!env.SMTP_ACCOUNTS.trim()) return []
  const parsed = smtpAccountsSchema.safeParse(JSON.parse(env.SMTP_ACCOUNTS))
  return parsed.success ? parsed.data : []
}

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
