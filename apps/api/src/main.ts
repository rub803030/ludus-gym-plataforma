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
import { type TokenClaims, verifyAccessToken } from './shared/jwt.js'
import { getCache, getRedisClient } from './shared/redis.js'
import { csrfGuard, getCsrfSecret } from './shared/middleware/csrf.js'
import { IDEMPOTENCY_TTL_SECONDS, idempotencyKeys } from './shared/middleware/idempotency.js'
import { registerAuthRoutes } from './modules/auth/routes.js'
import { registerMemberRoutes } from './modules/members/routes.js'
import { registerBillingRoutes } from './modules/billing/routes.js'
import { registerAccessRoutes } from './modules/access/routes.js'
import { registerWorkoutRoutes } from './modules/workouts-nutrition/routes.js'
import { registerAnalyticsRoutes } from './modules/analytics-audit/routes.js'
import { registerStaffRoutes } from './modules/staff-management/routes.js'
import { registerStorageRoutes } from './modules/storage/routes.js'
import { registerGymRoutes } from './modules/gyms/routes.js'
import { registerAdminRoutes } from './modules/admin/routes.js'

export async function buildApp() {
  const env = loadEnv()

  // Solo se confía en el proxy inmediato; `true` permitiría falsificar
  // X-Forwarded-For desde cualquier cliente para evadir el rate limit.
  const app = Fastify({ logger: { level: env.NODE_ENV === 'production' ? 'warn' : 'info' }, trustProxy: 1 })

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cookie, { secret: getCsrfSecret() })
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true })

  // Protección CSRF real para el console web (las apps móvil usan Bearer).
  app.addHook('onRequest', csrfGuard())

  // Con Redis el contador se comparte entre réplicas; sin él se usa el store
  // local del plugin (aceptable solo en desarrollo / una sola instancia).
  const rateLimitRedis = getRedisClient()
  await app.register(rateLimit, {
    max: env.NODE_ENV === 'test' ? 1000 : env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    nameSpace: 'ludus-rate-limit:',
    ...(rateLimitRedis ? { redis: rateLimitRedis } : {}),
    // Nunca derribamos la API si Redis cae; el store local sigue protegiendo.
    skipOnError: true,
  })

  // La respuesta de una operación idempotente se guarda para devolver el mismo
  // resultado en reintentos. Si falla, se libera el lock para permitir el retry.
  app.addHook('onSend', async (req, reply, payload) => {
    const key = req.idempotencyKey
    if (!key || reply.statusCode >= 400 || typeof payload !== 'string') return payload
    let body: unknown = payload
    try {
      body = JSON.parse(payload)
    } catch {
      // Se conserva el texto original si no era JSON.
    }
    const principalId = req.principal?.id ?? 'anon'
    const { response } = idempotencyKeys(principalId, key)
    await getCache().set(
      response,
      JSON.stringify({ status: reply.statusCode, body }),
      'EX',
      IDEMPOTENCY_TTL_SECONDS,
    )
    return payload
  })

  app.addHook('onError', async (req) => {
    const key = req.idempotencyKey
    if (!key) return
    const principalId = req.principal?.id ?? 'anon'
    const { lock, response } = idempotencyKeys(principalId, key)
    await getCache().del(lock)
    await getCache().del(response)
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
  await registerGymRoutes(app)
  await registerAdminRoutes(app)

  const io = new SocketServer(app.server, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  })
  io.on('connection', (socket) => {
    const authToken = socket.handshake.auth?.token ?? socket.handshake.query?.token
    if (typeof authToken !== 'string' || !authToken) {
      socket.disconnect(true)
      return
    }

    let claims: TokenClaims
    try {
      claims = verifyAccessToken(authToken)
    } catch {
      socket.disconnect(true)
      return
    }

    const ownGymId = claims.activeGymId ?? claims.gymId
    socket.on('subscribe:gym', (requestedGymId: string) => {
      if (typeof requestedGymId !== 'string' || !requestedGymId) return
      if (claims.role !== 'ADMIN' && requestedGymId !== ownGymId) return
      socket.join(`gym:${requestedGymId}`)
    })
  })
  const cache = getCache()
  void cache.subscribe('access:granted', (message) => {
    try {
      const payload = JSON.parse(message) as { gymId?: string; memberId?: string }
      if (!payload.gymId) return
      io.to(`gym:${payload.gymId}`).emit('access:granted', payload)
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
