import { createHmac, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { DomainError } from '../errors/domain-error.js'

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function signCsrf(secret: string, sessionId: string): string {
  return createHmac('sha256', secret).update(sessionId).digest('base64url')
}

export function csrfGuard(secret: string) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!MUTATIONS.has(req.method)) return
    if (req.headers['x-platform'] === 'mobile') return
    const token = req.headers['x-csrf-token']
    const sessionId = req.cookies['ludus_sid']
    if (typeof token !== 'string' || !sessionId) {
      throw new DomainError('FORBIDDEN', 'Falta el token CSRF', 403)
    }
    const expected = signCsrf(secret, sessionId)
    const a = Buffer.from(expected)
    const b = Buffer.from(token)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new DomainError('FORBIDDEN', 'Token CSRF inválido', 403)
    }
  }
}
