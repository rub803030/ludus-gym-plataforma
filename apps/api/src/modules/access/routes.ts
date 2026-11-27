import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../shared/database/prisma.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { getPrincipal } from '../../shared/middleware/request-context.js'
import { requirePermission } from '../../shared/middleware/rbac.js'
import { requireAuth } from '../../shared/http.js'
import { issueQr, issueOfflineCredential, verifyQr, type VerifiedQr } from '../../shared/qr.js'
import { getCache } from '../../shared/redis.js'
import { writeAudit } from '../../shared/audit.js'
import { activeMembershipWhere, assertActiveGymMembership } from '../../shared/membership-scope.js'

async function assertCapacity(gymId: string): Promise<void> {
  const gym = await prisma.gym.findUnique({ where: { id: gymId } })
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const occupancy = await prisma.accessEvent.count({
    where: { gymId, createdAt: { gte: startOfDay }, result: { in: ['GRANTED', 'OFFLINE_GRANTED'] } },
  })
  if (occupancy >= (gym?.capacity ?? Infinity)) {
    throw new DomainError('CONFLICT', 'Aforo completo. Intenta en unos minutos', 409)
  }
}

const verifySchema = z.object({ token: z.string().min(20) })
const manualSchema = z.object({ memberId: z.string().uuid(), notes: z.string().max(300).optional() })
const deviceSchema = z.object({ deviceId: z.string().min(6).max(128).default('ludus-door-01') })

export async function registerAccessRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/access/qr-token', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    if (principal.role !== 'MEMBER' || principal.platform !== 'mobile') {
      throw new DomainError('FORBIDDEN', 'Solo socios desde la app', 403)
    }
    const body = z.object({ gymId: z.string().uuid().optional() }).parse(req.body ?? {})
    const gymId = body.gymId ?? principal.activeGymId ?? principal.gymId
    if (!gymId) throw new DomainError('NO_GYM', 'Únete a algún gimnasio para tener acceso', 403)
    await assertActiveGymMembership(principal.id, gymId)
    const qr = issueQr(principal.id, gymId)
    return { ...qr, offlineCredential: issueOfflineCredential(principal.id, gymId) }
  })

  // Sincronización de eventos escaneados sin conexión por la app del socio.
  // El token está firmado con HMAC, por lo que no se confía en el memberId del
  // cuerpo: debe coincidir con la sesión y con el gimnasio activo.
  app.post('/api/access/events', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    if (principal.role !== 'MEMBER') {
      throw new DomainError('FORBIDDEN', 'Solo socios desde la app', 403)
    }
    const body = z.object({
      memberId: z.string().uuid(),
      token: z.string().min(20),
      scannedAt: z.number().int().positive(),
    }).parse(req.body)
    const gymId = principal.activeGymId ?? principal.gymId
    if (!gymId) throw new DomainError('NO_GYM', 'Únete a algún gimnasio para tener acceso', 403)
    if (body.memberId !== principal.id) {
      throw new DomainError('FORBIDDEN', 'El evento no pertenece al socio de la sesión', 403)
    }

    let decoded: VerifiedQr
    try {
      decoded = verifyQr(body.token)
    } catch {
      throw new DomainError('CONFLICT', 'Credencial offline inválida o expirada', 409)
    }
    if (decoded.memberId !== principal.id) {
      throw new DomainError('FORBIDDEN', 'El evento no pertenece al socio de la sesión', 403)
    }
    if (decoded.gymId !== gymId) {
      throw new DomainError('CROSS_GYM_PASS', 'Este pase pertenece a otro gimnasio', 403)
    }
    await assertActiveGymMembership(principal.id, gymId)

    const bucket = BigInt(Math.floor(body.scannedAt / 30_000))
    try {
      await prisma.accessEvent.create({
        data: {
          gymId,
          memberId: principal.id,
          qrBucket: bucket,
          result: decoded.offline ? 'OFFLINE_GRANTED' : 'GRANTED',
          offlineSynced: decoded.offline,
          deviceId: `mobile:${body.scannedAt}`,
        },
      })
    } catch {
      // Reenvío de la cola offline: el evento ya estaba registrado.
    }
    return { ok: true }
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
    let decoded: VerifiedQr
    try {
      decoded = verifyQr(body.token)
    } catch (error) {
      throw new DomainError('CONFLICT', error instanceof Error ? error.message : 'QR inválido', 409)
    }
    if (decoded.gymId !== principal.gymId) {
      throw new DomainError('CROSS_GYM_PASS', 'Este pase pertenece a otro gimnasio', 403)
    }

    const member = await prisma.member.findFirst({
      where: { id: decoded.memberId, deletedAt: null },
      include: { memberships: { where: activeMembershipWhere(decoded.gymId), take: 1 } },
    })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
    await assertActiveGymMembership(member.id, decoded.gymId)

    const membership = member.memberships[0]
    if (!membership?.endDate || membership.endDate.getTime() < Date.now()) {
      await prisma.accessEvent.create({
        data: { gymId: principal.gymId, memberId: member.id, qrBucket: BigInt(decoded.bucket), result: 'DENIED_EXPIRED', deviceId: body.deviceId },
      })
      throw new DomainError('MEMBERSHIP_EXPIRED', 'La membresía venció. Renueva antes de dar acceso', 403)
    }

    await assertCapacity(principal.gymId)

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
    await getCache().publish(
      'access:granted',
      JSON.stringify({ gymId: principal.gymId, memberId: member.id, name: `${member.firstName} ${member.lastName}` }),
    )
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
      where: { id: body.memberId, deletedAt: null },
      include: { memberships: { where: activeMembershipWhere(principal.gymId), take: 1 } },
    })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
    await assertActiveGymMembership(member.id, principal.gymId)

    const membership = member.memberships[0]
    if (!membership?.endDate || membership.endDate.getTime() < Date.now()) {
      throw new DomainError('MEMBERSHIP_EXPIRED', 'La membresía venció; puedes renovarla aquí mismo antes de dar acceso', 403)
    }
    await assertCapacity(principal.gymId)

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
