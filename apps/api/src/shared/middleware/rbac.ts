import type { FastifyReply, FastifyRequest } from 'fastify'
import { hasPermission, type Permission, type Role } from '@ludus/shared'
import { DomainError } from '../errors/domain-error.js'
import { getPrincipal } from './request-context.js'

export function requirePermission(permission: Permission) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const principal = getPrincipal(req)
    if (principal.platform === 'web' && principal.role === 'MEMBER') {
      throw new DomainError('FORBIDDEN', 'La plataforma web es exclusiva del equipo', 403)
    }
    if (principal.platform === 'mobile' && principal.role !== 'MEMBER') {
      throw new DomainError('FORBIDDEN', 'La app móvil es exclusiva de socios', 403)
    }
    if (!hasPermission(principal.role as Role, permission)) {
      throw new DomainError('FORBIDDEN', 'Sin permiso para esta operación', 403)
    }
  }
}

export function requireRole(...roles: readonly Role[]) {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const principal = getPrincipal(req)
    if (!roles.includes(principal.role as Role)) {
      throw new DomainError('FORBIDDEN', 'Rol no autorizado para esta operación', 403)
    }
  }
}

/** Administrador global: puede autorizar altas sin depender de un tenant activo. */
export function requireAdmin(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const principal = getPrincipal(req)
  if (principal.platform !== 'web' || principal.role !== 'ADMIN') {
    throw new DomainError('FORBIDDEN', 'Esta operación es exclusiva de administradores globales', 403)
  }
  return Promise.resolve()
}

export function requirePlatform(platform: 'web' | 'mobile') {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const principal = getPrincipal(req)
    if (principal.platform !== platform) {
      throw new DomainError('FORBIDDEN', `Esta operación requiere la plataforma ${platform}`, 403)
    }
  }
}

/** Socio autenticado en la app móvil: el id del principal es su memberId. */
export function requireMobileMember(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const principal = getPrincipal(req)
  if (principal.platform !== 'mobile' || principal.role !== 'MEMBER') {
    throw new DomainError('FORBIDDEN', 'Esta operación es exclusiva de socios en la app móvil', 403)
  }
  return Promise.resolve()
}
