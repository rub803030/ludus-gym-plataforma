import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { DomainError } from '../errors/domain-error.js'

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
let cachedSecret: string | null = null

/**
 * Secreto CSRF compartido por el guard y el endpoint de login.
 * En producción env.ts exige un valor de 32+ bytes; el aleatorio solo
 * existe para desarrollo y cambia en cada reinicio (nunca se persiste).
 */
export function getCsrfSecret(): string {
  if (cachedSecret) return cachedSecret
  cachedSecret = process.env.CSRF_SECRET || randomBytes(32).toString('hex')
  return cachedSecret
}

export function signCsrf(secret: string, sessionId: string): string {
  return createHmac('sha256', secret).update(sessionId).digest('base64url')
}

export function csrfGuard() {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!MUTATIONS.has(req.method)) return
    // Las apps móvil usan Bearer + x-platform; el navegador usa cookies.
    if (req.headers['x-platform'] === 'mobile') return
    if (req.headers.authorization?.startsWith('Bearer ')) return
    // El login debe poder crearse a sí mismo: aún no hay sid ni token CSRF.
    if (req.url.startsWith('/api/auth/web/login') || req.url.startsWith('/api/auth/mobile/login')) return
    const token = req.headers['x-csrf-token']
    const sessionId = req.cookies['ludus_sid']
    if (typeof token !== 'string' || !sessionId) {
      throw new DomainError('FORBIDDEN', 'Falta el token CSRF', 403)
    }
    const expected = signCsrf(getCsrfSecret(), sessionId)
    const a = Buffer.from(expected)
    const b = Buffer.from(token)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new DomainError('FORBIDDEN', 'Token CSRF inválido', 403)
    }
  }
}
