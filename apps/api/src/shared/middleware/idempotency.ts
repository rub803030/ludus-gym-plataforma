import type { FastifyReply, FastifyRequest } from 'fastify'
import { DomainError } from '../errors/domain-error.js'
import { getCache } from '../redis.js'

export const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24

export function idempotencyKeys(principalId: string, key: string) {
  return {
    lock: `idem:${principalId}:${key}`,
    response: `idem:resp:${principalId}:${key}`,
  }
}

export async function idempotencyGuard(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const key = req.headers['idempotency-key']
  if (typeof key !== 'string' || key.length < 16 || key.length > 128) {
    throw new DomainError('VALIDATION_ERROR', 'Idempotency-Key requerido (16-128 caracteres)', 400)
  }
  const principalId = req.principal?.id ?? 'anon'
  const { lock, response } = idempotencyKeys(principalId, key)

  // Un reintento legítimo recibe la misma respuesta, no un 409 genérico.
  const cached = await getCache().get(response)
  if (cached) {
    try {
      const saved = JSON.parse(cached) as { status: number; body: unknown }
      void reply.code(saved.status).send(saved.body)
      return
    } catch {
      await getCache().del(response)
    }
  }

  const acquired = await getCache().set(lock, req.method, 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX')
  if (acquired !== 'OK') {
    throw new DomainError('IDEMPOTENCY_REPLAY', 'Esta operación ya fue procesada', 409)
  }
  req.idempotencyKey = key
}
