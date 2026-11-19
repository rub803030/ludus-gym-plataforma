import type { FastifyReply, FastifyRequest } from 'fastify'
import { verifyAccessToken } from './jwt.js'
import { DomainError } from './errors/domain-error.js'
import type { Principal } from '@ludus/shared'

export function tokenFromRequest(req: FastifyRequest): string | null {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  const cookie = req.cookies['ludus_token']
  return typeof cookie === 'string' ? cookie : null
}

export function authenticate(req: FastifyRequest): Principal {
  const token = tokenFromRequest(req)
  if (!token) throw new DomainError('UNAUTHORIZED', 'Inicia sesión para continuar', 401)
  const claims = verifyAccessToken(token)
  return {
    id: claims.sub,
    role: claims.role,
    platform: claims.platform,
    jti: claims.jti,
    gymId: claims.gymId,
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  req.principal = authenticate(req)
  const { assertNotRevoked } = await import('./middleware/revocation.js')
  await assertNotRevoked(req)
  reply.header('Cache-Control', 'no-store')
}

export function parsePagination(query: Record<string, unknown>): { page: number; limit: number; search: string } {
  const page = Math.max(1, Number(query['page'] ?? 1) || 1)
  const limit = Math.min(100, Math.max(1, Number(query['limit'] ?? 20) || 20))
  const search = typeof query['search'] === 'string' ? query['search'].slice(0, 120) : ''
  return { page, limit, search }
}
