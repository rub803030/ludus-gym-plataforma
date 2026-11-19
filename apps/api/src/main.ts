import './config/dotenv.js'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { ZodError } from 'zod'
import { Server as SocketServer } from 'socket.io'
import { loadEnv } from './config/env.js'
import { DomainError } from './shared/errors/domain-error.js'
import { getCache } from './shared/redis.js'
import { registerAuthRoutes } from './modules/auth/routes.js'
import { registerMemberRoutes } from './modules/members/routes.js'
import { registerBillingRoutes } from './modules/billing/routes.js'
import { registerAccessRoutes } from './modules/access/routes.js'
import { registerWorkoutRoutes } from './modules/workouts-nutrition/routes.js'
import { registerAnalyticsRoutes } from './modules/analytics-audit/routes.js'
import { registerStaffRoutes } from './modules/staff-management/routes.js'
import { registerStorageRoutes } from './modules/storage/routes.js'

export async function buildApp() {
  let env
  try {
    env = loadEnv()
  } catch {
    env = {
      NODE_ENV: (process.env.NODE_ENV ?? 'development') as 'development',
      API_PORT: Number(process.env.API_PORT ?? 4000),
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      REDIS_URL: process.env.REDIS_URL ?? '',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? '',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? '',
      QR_HMAC_SECRET: process.env.QR_HMAC_SECRET ?? '',
      FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY ?? '',
      CSRF_SECRET: process.env.CSRF_SECRET ?? '',
      CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    }
  }

  const app = Fastify({ logger: { level: env.NODE_ENV === 'production' ? 'warn' : 'info' }, trustProxy: true })

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cookie, { secret: env.CSRF_SECRET || 'dev-cookie-secret' })
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true })
  await app.register(rateLimit, {
    max: env.NODE_ENV === 'test' ? 1000 : 120,
    timeWindow: '1 minute',
  })

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof DomainError) {
      void reply.code(error.status).send({
        error: { code: error.code, message: error.message, details: error.details },
      })
      return
    }
    if (error instanceof ZodError) {
      void reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Datos inválidos' },
      })
      return
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (status >= 500) app.log.error(error)
    void reply.code(status).send({
      error: { code: 'INTERNAL_ERROR', message: status >= 500 ? 'Ocurrió un error. Intenta de nuevo' : error.message },
    })
  })

  app.get('/health', async () => ({ status: 'ok', service: 'ludus-api', at: new Date().toISOString() }))

  await registerAuthRoutes(app)
  await registerMemberRoutes(app)
  await registerBillingRoutes(app)
  await registerAccessRoutes(app)
  await registerWorkoutRoutes(app)
  await registerAnalyticsRoutes(app)
  await registerStaffRoutes(app)
  await registerStorageRoutes(app)

  const io = new SocketServer(app.server, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  })
  io.on('connection', (socket) => {
    socket.on('subscribe:gym', (gymId: string) => socket.join(`gym:${gymId}`))
  })
  const cache = getCache()
  void cache.subscribe('access:granted', (message) => {
    try {
      const payload = JSON.parse(message) as { memberId?: string }
      io.to('gym:00000000-0000-7000-8000-000000000001').emit('access:granted', payload)
      io.emit('access:granted', payload)
    } catch {
      // Mensaje ignorado
    }
  })

  app.addHook('onClose', async () => {
    io.close()
  })

  return app
}

const isMain = process.argv[1]?.endsWith('main.ts') || process.argv[1]?.endsWith('main.js')
if (isMain) {
  const app = await buildApp()
  const port = Number(process.env.API_PORT ?? 4000)
  try {
    await app.listen({ port, host: '0.0.0.0' })
    app.log.info(`Ludus API lista en http://localhost:${port}`)
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}
