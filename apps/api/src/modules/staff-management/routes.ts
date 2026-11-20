import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PERMISSIONS, ROLE_RANK, hasPermission, outranks, type Role } from '@ludus/shared'
import { prisma } from '../../shared/database/prisma.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { getPrincipal } from '../../shared/middleware/request-context.js'
import { requirePermission } from '../../shared/middleware/rbac.js'
import { requireAuth } from '../../shared/http.js'
import { changeStaffRole, createStaff, suspendStaff } from '../auth/auth-service.js'
import { issueVerification } from '../auth/email-verification.js'
import { writeAudit } from '../../shared/audit.js'

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  fullName: z.string().min(2).max(120),
  role: z.enum(['OWNER', 'MANAGER', 'STAFF']),
})
const roleSchema = z.object({ role: z.enum(['OWNER', 'MANAGER', 'STAFF']) })
const suspendSchema = z.object({ suspended: z.boolean() })

export async function registerStaffRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/staff', { preHandler: [requireAuth, requirePermission('staff:manage')] }, async (req) => {
    const staff = await prisma.staffUser.findMany({
      where: { gymId: getPrincipal(req).gymId, deletedAt: null },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, suspendedAt: true, lastLoginAt: true, emailVerified: true, emailVerifiedAt: true },
      orderBy: { createdAt: 'asc' },
    })
    return {
      items: staff,
      permissions: PERMISSIONS,
      ranks: ROLE_RANK,
      canManage: (role: Role) => outranks(getPrincipal(req).role, role),
    }
  })

  app.post('/api/staff', { preHandler: [requireAuth, requirePermission('staff:manage')] }, async (req, reply) => {
    const body = createSchema.parse(req.body)
    const principal = getPrincipal(req)
    if (body.role === 'OWNER' && principal.role !== 'OWNER') {
      throw new DomainError('FORBIDDEN', 'Solo OWNER puede crear otro OWNER', 403)
    }
    const staff = await createStaff({ gymId: principal.gymId, ...body, role: body.role })
    await issueVerification({
      kind: 'staff',
      id: staff.id,
      email: staff.email,
      name: staff.fullName,
      platform: 'web',
    })
    await writeAudit({
      gymId: principal.gymId,
      actorId: principal.id,
      actorRole: principal.role,
      action: 'staff.create',
      entity: 'staff',
      after: { email: body.email, role: body.role },
    })
    reply.code(201)
    return { ok: true, email: body.email, verificationSent: true }
  })

  app.patch('/api/staff/:id/role', { preHandler: [requireAuth, requirePermission('staff:manage')] }, async (req) => {
    const { id } = req.params as { id: string }
    const body = roleSchema.parse(req.body)
    const principal = getPrincipal(req)
    const target = await prisma.staffUser.findFirst({ where: { id, gymId: principal.gymId } })
    if (!target) throw new DomainError('NOT_FOUND', 'Usuario no encontrado', 404)
    if (!outranks(principal.role, target.role as Role)) {
      throw new DomainError('FORBIDDEN', 'No puedes modificar a un usuario de rango igual o superior', 403)
    }
    if (body.role === 'OWNER' && principal.role !== 'OWNER') {
      throw new DomainError('FORBIDDEN', 'Solo OWNER puede asignar OWNER', 403)
    }
    await changeStaffRole(id, body.role)
    await writeAudit({
      gymId: principal.gymId,
      actorId: principal.id,
      actorRole: principal.role,
      action: 'staff.role',
      entity: 'staff',
      entityId: id,
      after: { role: body.role },
    })
    return { ok: true, role: body.role }
  })

  app.patch('/api/staff/:id/suspend', { preHandler: [requireAuth, requirePermission('staff:manage')] }, async (req) => {
    const { id } = req.params as { id: string }
    const body = suspendSchema.parse(req.body)
    const principal = getPrincipal(req)
    const target = await prisma.staffUser.findFirst({ where: { id, gymId: principal.gymId } })
    if (!target) throw new DomainError('NOT_FOUND', 'Usuario no encontrado', 404)
    if (target.id === principal.id) throw new DomainError('FORBIDDEN', 'No puedes suspender tu propia licencia', 403)
    if (!outranks(principal.role, target.role as Role)) {
      throw new DomainError('FORBIDDEN', 'No puedes suspender a un usuario de rango igual o superior', 403)
    }
    await suspendStaff(id, body.suspended)
    await writeAudit({
      gymId: principal.gymId,
      actorId: principal.id,
      actorRole: principal.role,
      action: body.suspended ? 'staff.suspend' : 'staff.reactivate',
      entity: 'staff',
      entityId: id,
    })
    return { ok: true, suspended: body.suspended }
  })

  app.patch('/api/staff/:id', { preHandler: [requireAuth, requirePermission('staff:manage')] }, async (req) => {
    const { id } = req.params as { id: string }
    const body = z.object({
      role: z.enum(['OWNER', 'MANAGER', 'STAFF']).optional(),
      suspended: z.boolean().optional(),
      isActive: z.boolean().optional(),
      fullName: z.string().min(2).max(120).optional(),
    }).parse(req.body)
    const principal = getPrincipal(req)
    const target = await prisma.staffUser.findFirst({ where: { id, gymId: principal.gymId } })
    if (!target) throw new DomainError('NOT_FOUND', 'Usuario no encontrado', 404)
    if (body.fullName) {
      await prisma.staffUser.update({ where: { id }, data: { fullName: body.fullName } })
    }
    const suspended = body.suspended ?? (body.isActive === false ? true : undefined)
    if (suspended !== undefined) {
      if (id === principal.id) throw new DomainError('FORBIDDEN', 'No puedes suspender tu propia licencia', 403)
      if (!outranks(principal.role, target.role as Role)) {
        throw new DomainError('FORBIDDEN', 'No puedes modificar a un usuario de rango igual o superior', 403)
      }
      await suspendStaff(id, suspended)
    }
    if (body.role && body.role !== target.role) {
      if (!outranks(principal.role, target.role as Role)) {
        throw new DomainError('FORBIDDEN', 'No puedes modificar a un usuario de rango igual o superior', 403)
      }
      if (body.role === 'OWNER' && principal.role !== 'OWNER') {
        throw new DomainError('FORBIDDEN', 'Solo OWNER puede asignar OWNER', 403)
      }
      await changeStaffRole(id, body.role)
    }
    const updated = await prisma.staffUser.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, suspendedAt: true, lastLoginAt: true, emailVerified: true, emailVerifiedAt: true },
    })
    return updated
  })

  app.get('/api/staff/permissions', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    return {
      role: principal.role,
      permissions: PERMISSIONS.filter((permission) => hasPermission(principal.role, permission)),
    }
  })
}
