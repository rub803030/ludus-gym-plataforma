import type { FastifyReply, FastifyRequest } from 'fastify'
import { verifyAccessToken } from './jwt.js'
import { DomainError } from './errors/domain-error.js'
import type { Principal } from '@ludus/shared'
import { needsGymContext, requireGymContext } from './middleware/gym-context.js'
import { prisma } from './database/prisma.js'

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
  // Tokens emitidos antes del cambio no traen activeGymId: se usa gymId.
  const activeGymId = claims.activeGymId ?? claims.gymId ?? null
  return {
    id: claims.sub,
    role: claims.role,
    platform: claims.platform,
    jti: claims.jti,
    gymId: activeGymId ?? '',
    activeGymId,
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  req.principal = authenticate(req)
  const { assertNotRevoked } = await import('./middleware/revocation.js')
  await assertNotRevoked(req)
  const path = req.url.split('?')[0] ?? ''
  if (req.principal.role === 'MEMBER' && path !== '/api/auth/logout') {
    const member = await prisma.member.findFirst({
      where: { id: req.principal.id, deletedAt: null },
      select: { status: true },
    })
    if (!member) throw new DomainError('UNAUTHORIZED', 'Socio no encontrado', 401)
    if (member.status === 'SUSPENDED') {
      throw new DomainError('USER_INACTIVE', 'La cuenta del socio está suspendida', 403)
    }
  }
  if (needsGymContext(req)) await requireGymContext(req, reply)
  reply.header('Cache-Control', 'no-store')
}

export function parsePagination(query: Record<string, unknown>): { page: number; limit: number; search: string } {
  const page = Math.max(1, Number(query['page'] ?? 1) || 1)
  const limit = Math.min(100, Math.max(1, Number(query['limit'] ?? 20) || 20))
  const search = typeof query['search'] === 'string' ? query['search'].slice(0, 120) : ''
  return { page, limit, search }
}
