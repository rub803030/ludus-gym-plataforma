import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../shared/database/prisma.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { getPrincipal } from '../../shared/middleware/request-context.js'
import { requirePermission } from '../../shared/middleware/rbac.js'
import { requireAuth } from '../../shared/http.js'
import { issueQr, issueOfflineCredential, verifyQr } from '../../shared/qr.js'
import { getCache } from '../../shared/redis.js'
import { writeAudit } from '../../shared/audit.js'

const verifySchema = z.object({ token: z.string().min(20) })
const manualSchema = z.object({ memberId: z.string().uuid(), notes: z.string().max(300).optional() })
const deviceSchema = z.object({ deviceId: z.string().min(6).max(128).default('ludus-door-01') })

export async function registerAccessRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/access/qr-token', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    if (principal.role !== 'MEMBER' || principal.platform !== 'mobile') {
      throw new DomainError('FORBIDDEN', 'Solo socios desde la app', 403)
    }
    const qr = issueQr(principal.id)
    return { ...qr, offlineCredential: issueOfflineCredential(principal.id) }
  })

  app.get('/api/access/occupancy', { preHandler: [requireAuth, requirePermission('access:checkin')] }, async (req) => {
    const principal = getPrincipal(req)
    const gym = await prisma.gym.findUnique({ where: { id: principal.gymId } })
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const today = await prisma.accessEvent.count({
      where: {
        gymId: principal.gymId,
        createdAt: { gte: startOfDay },
        result: { in: ['GRANTED', 'OFFLINE_GRANTED'] },
      },
    })
    return {
      count: today,
      capacity: gym?.capacity ?? 0,
      available: Math.max(0, (gym?.capacity ?? 0) - today),
      updatedAt: new Date().toISOString(),
    }
  })

  app.post('/api/access/verify-qr', { preHandler: [requireAuth, requirePermission('access:checkin')] }, async (req) => {
    const body = z.object({ token: z.string().min(20), deviceId: z.string().optional() }).parse(req.body)
    const principal = getPrincipal(req)
    let decoded: { memberId: string; bucket: number; offline: boolean }
    try {
      decoded = verifyQr(body.token)
    } catch (error) {
      throw new DomainError('CONFLICT', error instanceof Error ? error.message : 'QR inválido', 409)
    }

    const member = await prisma.member.findFirst({
      where: { id: decoded.memberId, gymId: principal.gymId },
      include: { memberships: { where: { status: 'ACTIVE' }, take: 1 } },
    })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)

    const membership = member.memberships[0]
    if (!membership?.endDate || membership.endDate.getTime() < Date.now()) {
      await prisma.accessEvent.create({
        data: { gymId: principal.gymId, memberId: member.id, qrBucket: BigInt(decoded.bucket), result: 'DENIED_EXPIRED', deviceId: body.deviceId },
      })
      throw new DomainError('MEMBERSHIP_EXPIRED', 'La membresía venció. Renueva antes de dar acceso', 403)
    }

    const gym = await prisma.gym.findUnique({ where: { id: principal.gymId } })
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const occupancy = await prisma.accessEvent.count({
      where: { gymId: principal.gymId, createdAt: { gte: startOfDay }, result: { in: ['GRANTED', 'OFFLINE_GRANTED'] } },
    })
    if (occupancy >= (gym?.capacity ?? Infinity)) {
      throw new DomainError('CONFLICT', 'Aforo completo. Intenta en unos minutos', 409)
    }

    try {
      await prisma.accessEvent.create({
        data: {
          gymId: principal.gymId,
          memberId: member.id,
          qrBucket: BigInt(decoded.bucket),
          result: decoded.offline ? 'OFFLINE_GRANTED' : 'GRANTED',
          offlineSynced: decoded.offline,
          deviceId: body.deviceId,
          checkedBy: principal.id,
        },
      })
    } catch {
      throw new DomainError('IDEMPOTENCY_REPLAY', 'Este QR ya fue usado', 409)
    }
    await getCache().publish('access:granted', JSON.stringify({ memberId: member.id, name: `${member.firstName} ${member.lastName}` }))
    await writeAudit({
      gymId: principal.gymId,
      actorId: principal.id,
      actorRole: principal.role,
      action: 'access.qr',
      entity: 'member',
      entityId: member.id,
    })
    return {
      granted: true,
      member: { id: member.id, name: `${member.firstName} ${member.lastName}`, code: member.code },
      offline: decoded.offline,
    }
  })

  app.post('/api/access/manual-checkin', { preHandler: [requireAuth, requirePermission('access:checkin')] }, async (req, reply) => {
    const body = z.object({ memberId: z.string().uuid(), notes: z.string().max(300).optional() }).parse(manualSchema.parse(req.body))
    const principal = getPrincipal(req)
    const member = await prisma.member.findFirst({
      where: { id: body.memberId, gymId: principal.gymId },
      include: { memberships: { where: { status: 'ACTIVE' }, take: 1 } },
    })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
    const membership = member.memberships[0]
    if (!membership?.endDate || membership.endDate.getTime() < Date.now()) {
      throw new DomainError('MEMBERSHIP_EXPIRED', 'La membresía venció; puedes renovarla aquí mismo antes de dar acceso', 403)
    }
    // Los buckets QR son siempre positivos (Date.now()/30_000). Usamos un
    // espacio negativo con granularidad de milisegundos para que un check-in
    // manual nunca colisione con el constraint único (member, bucket, result).
    const bucket = -BigInt(Date.now())
    try {
      await prisma.accessEvent.create({
        data: {
          gymId: principal.gymId,
          memberId: member.id,
          qrBucket: bucket,
          result: 'GRANTED',
          deviceId: body.notes ?? 'manual',
          checkedBy: principal.id,
        },
      })
    } catch {
      throw new DomainError('IDEMPOTENCY_REPLAY', 'Este check-in ya fue registrado', 409)
    }
    reply.code(201)
    return { granted: true, member: { id: member.id, name: `${member.firstName} ${member.lastName}` } }
  })

  app.get('/api/access/events', { preHandler: [requireAuth, requirePermission('access:checkin')] }, async (req) => {
    const events = await prisma.accessEvent.findMany({
      where: { gymId: getPrincipal(req).gymId },
      include: { member: { select: { firstName: true, lastName: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return events.map((e) => ({
      id: e.id,
      memberName: `${e.member.firstName} ${e.member.lastName}`,
      memberCode: e.member.code,
      result: e.result,
      offline: e.offlineSynced,
      createdAt: e.createdAt.toISOString(),
    }))
  })
}
