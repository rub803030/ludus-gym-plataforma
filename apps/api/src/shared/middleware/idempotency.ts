import type { FastifyReply, FastifyRequest } from 'fastify'
import { DomainError } from '../errors/domain-error.js'
import { getCache } from '../redis.js'

const TTL_SECONDS = 60 * 60 * 24

export async function idempotencyGuard(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const key = req.headers['idempotency-key']
  if (typeof key !== 'string' || key.length < 16 || key.length > 128) {
    throw new DomainError('VALIDATION_ERROR', 'Idempotency-Key requerido (16-128 caracteres)', 400)
  }
  const principalId = req.principal?.id ?? 'anon'
  const cacheKey = `idem:${principalId}:${key}`
  const acquired = await getCache().set(cacheKey, req.method, 'EX', TTL_SECONDS, 'NX')
  if (acquired !== 'OK') {
    throw new DomainError('IDEMPOTENCY_REPLAY', 'Esta operación ya fue procesada', 409)
  }
  req.idempotencyKey = key
}
