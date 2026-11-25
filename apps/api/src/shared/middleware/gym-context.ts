import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../database/prisma.js'
import { DomainError } from '../errors/domain-error.js'
import { getPrincipal } from './request-context.js'

/**
 * Aislamiento multi-tenant. requireAuth lo invoca automáticamente salvo en
 * las rutas que necesitan funcionar antes de tener un gimnasio activo.
 */
const GYM_FREE_PATHS = new Set([
  '/api/members/register',
  '/api/members/join-gym',
  '/api/members/my-gyms',
  '/api/members/switch-gym',
  '/api/members/me',
  '/api/access/qr-token',
])

export function needsGymContext(req: FastifyRequest): boolean {
  const path = req.url.split('?')[0] ?? ''
  if (path.startsWith('/api/auth/')) return false
  if (path === '/api/gyms/register' || path === '/api/gyms/verify') return false
  return !GYM_FREE_PATHS.has(path)
}

export async function requireGymContext(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const principal = getPrincipal(req)
  const gymId = principal.activeGymId ?? principal.gymId
  if (!gymId) {
    throw new DomainError('NO_GYM', 'Únete a algún gimnasio para tener acceso', 403)
  }
  const gym = await prisma.gym.findFirst({
    where: { id: gymId, deletedAt: null },
    select: { status: true },
  })
  if (!gym || gym.status !== 'ACTIVE') {
    throw new DomainError('GYM_NOT_ACTIVE', 'Este gimnasio todavía no está activo', 403)
  }
}

/** Devuelve el gimnasio activo de la petición ya autenticada. */
export function gymIdOf(req: FastifyRequest): string {
  const principal = getPrincipal(req)
  return principal.activeGymId ?? principal.gymId
}
