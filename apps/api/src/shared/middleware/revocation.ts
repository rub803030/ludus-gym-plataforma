import type { FastifyRequest } from 'fastify'
import { DomainError } from '../errors/domain-error.js'
import { getCache } from '../redis.js'
import { getPrincipal } from './request-context.js'

export async function assertNotRevoked(req: FastifyRequest): Promise<void> {
  const principal = getPrincipal(req)
  const cache = getCache()
  const revokedJti = await cache.get(`revoked:jti:${principal.jti}`)
  const revokedUser = await cache.get(`revoked:user:${principal.id}`)
  if (revokedJti || revokedUser) {
    throw new DomainError('UNAUTHORIZED', 'La licencia fue revocada. Inicia sesión de nuevo', 401)
  }
}
