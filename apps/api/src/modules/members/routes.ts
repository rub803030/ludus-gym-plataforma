import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createMemberSchema, hasPermission, joinGymSchema, registerMemberSchema } from '@ludus/shared'
import { randomInt } from 'node:crypto'
import { prisma } from '../../shared/database/prisma.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { getPrincipal } from '../../shared/middleware/request-context.js'
import { requirePermission } from '../../shared/middleware/rbac.js'
import { requireAuth, parsePagination } from '../../shared/http.js'
import { decryptOptional, encryptOptional } from '../../shared/crypto.js'
import { generateTemporaryPassword, hashPassword } from '../../shared/password.js'
import { writeAudit } from '../../shared/audit.js'
import { issueVerification, verificationResponse } from '../auth/email-verification.js'
import { issueMemberSession } from '../auth/auth-service.js'
import { verifyEnrollmentQr } from '../../shared/gym-qr.js'
import { activeMembershipWhere, assertActiveGymMembership } from '../../shared/membership-scope.js'

const updateSchema = createMemberSchema.partial().extend({ status: z.enum(['ACTIVE', 'PENDING', 'EXPIRED', 'SUSPENDED']).optional() })

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new DomainError('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'Datos inválidos', 400)
  return result.data
}

function toDto(member: {
  id: string; code: string; firstName: string; lastName: string; email: string; phone: string | null
  documentNumber: string | null; status: string; joinedAt: Date; createdAt: Date; emailVerified?: boolean
  memberships?: Array<{ status: string; endDate: Date | null; plan: { name: string } }>
}) {
  const active = member.memberships?.find((m) => m.status === 'ACTIVE')
  return {
    id: member.id,
    code: member.code,
    name: `${member.firstName} ${member.lastName}`,
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    phone: member.phone ?? '',
    document: member.documentNumber ?? '',
    status: member.status,
    emailVerified: member.emailVerified ?? false,
    joinedAt: member.joinedAt.toISOString(),
    createdAt: member.createdAt.toISOString(),
    membership: active
      ? { planName: active.plan.name, endDate: active.endDate?.toISOString() ?? null, status: active.status }
      : null,
  }
}

async function nextMemberCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `LUD-${String(randomInt(0, 1_000_000)).padStart(6, '0')}`
    const existing = await prisma.member.findFirst({ where: { code } })
    if (!existing) return code
  }
  throw new DomainError('CONFLICT', 'No se pudo generar un código de socio', 409)
}

export async function registerMemberRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/members/register', async (req, reply) => {
    const body = parse(registerMemberSchema, req.body)
    const existing = await prisma.member.findFirst({
      where: { email: { equals: body.email, mode: 'insensitive' }, deletedAt: null },
    })
    if (existing) throw new DomainError('CONFLICT', 'Ya existe una cuenta con ese correo', 409)
    const member = await prisma.member.create({
      data: {
        code: await nextMemberCode(),
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email.toLowerCase(),
        phone: body.phone ?? null,
        documentNumber: body.documentNumber ?? null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        passwordHash: hashPassword(body.password),
        status: 'PENDING',
        emailVerified: false,
      },
    })
    const issued = await issueVerification({
      kind: 'member',
      id: member.id,
      email: member.email,
      name: `${member.firstName} ${member.lastName}`,
      platform: 'mobile',
    })
    reply.code(201)
    return {
      member: { id: member.id, code: member.code, email: member.email },
      verification: verificationResponse(issued),
    }
  })

  app.post('/api/members/join-gym', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    if (principal.role !== 'MEMBER' || principal.platform !== 'mobile') {
      throw new DomainError('FORBIDDEN', 'La vinculación es exclusiva de socios en la app', 403)
    }
    const body = parse(joinGymSchema, req.body)
    const rawCode = body.code.trim()
    let gymId: string

    try {
      const decoded = verifyEnrollmentQr(rawCode)
      const signedGym = await prisma.gym.findFirst({
        where: { id: decoded.gymId, publicCode: decoded.code, deletedAt: null },
      })
      if (!signedGym) throw new Error('QR de gimnasio no vigente')
      gymId = decoded.gymId
    } catch {
      const byCode = await prisma.gym.findFirst({
        where: { publicCode: rawCode.toUpperCase(), deletedAt: null },
      })
      if (!byCode) throw new DomainError('NOT_FOUND', 'No encontramos ese gimnasio. Revisa el código', 404)
      gymId = byCode.id
    }

    const gym = await prisma.gym.findFirst({ where: { id: gymId, deletedAt: null } })
    if (!gym) throw new DomainError('NOT_FOUND', 'No encontramos ese gimnasio. Revisa el código', 404)
    if (gym.status !== 'ACTIVE') {
      throw new DomainError('GYM_NOT_ACTIVE', 'Este gimnasio todavía no está activo', 403)
    }

    const member = await prisma.member.findUnique({ where: { id: principal.id } })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
    const key = { gymId, memberId: member.id }
    const previous = await prisma.gymMembership.findUnique({ where: { gymId_memberId: key } })
    if (previous?.status === 'SUSPENDED') {
      throw new DomainError('CONFLICT', 'Tu membresía en este gimnasio está suspendida', 409)
    }
    await prisma.gymMembership.upsert({
      where: { gymId_memberId: key },
      create: { gymId, memberId: member.id, status: 'ACTIVE', isActive: true, joinedAt: new Date() },
      update: { status: 'ACTIVE', isActive: true, deletedAt: null },
    })
    if (!member.gymId) {
      await prisma.member.update({ where: { id: member.id }, data: { gymId } })
    }
    const tokens = await issueMemberSession(member.id, gymId, 'ludus-android')
    return {
      gym: { id: gym.id, name: gym.name, publicCode: gym.publicCode, status: gym.status },
      activeGymId: gymId,
      alreadyMember: Boolean(previous),
      tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
    }
  })

  app.post('/api/members/switch-gym', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    if (principal.role !== 'MEMBER' || principal.platform !== 'mobile') {
      throw new DomainError('FORBIDDEN', 'El cambio de gimnasio es exclusivo de la app', 403)
    }
    const body = parse(z.object({ gymId: z.string().uuid() }), req.body)
    const link = await prisma.gymMembership.findFirst({
      where: {
        memberId: principal.id,
        gymId: body.gymId,
        isActive: true,
        status: 'ACTIVE',
        deletedAt: null,
        gym: { status: 'ACTIVE', deletedAt: null },
      },
      include: { gym: { select: { id: true, name: true, publicCode: true } } },
    })
    if (!link) throw new DomainError('NO_GYM', 'No perteneces a ese gimnasio', 403)
    const tokens = await issueMemberSession(principal.id, body.gymId, 'ludus-android')
    return {
      gym: link.gym,
      activeGymId: body.gymId,
      tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
    }
  })

  app.get('/api/members/my-gyms', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    if (principal.role !== 'MEMBER') throw new DomainError('FORBIDDEN', 'Solo socios', 403)
    const links = await prisma.gymMembership.findMany({
      where: { memberId: principal.id, deletedAt: null },
      include: { gym: true },
      orderBy: { joinedAt: 'asc' },
    })
    const usable = links.filter(
      (link) => link.isActive && link.status === 'ACTIVE' && link.gym.status === 'ACTIVE',
    )
    const active = usable.find((link) => link.gymId === principal.activeGymId) ?? usable[0]
    return {
      activeGymId: active?.gymId ?? null,
      gyms: links.map((link) => ({
        id: link.gymId,
        name: link.gym.name,
        publicCode: link.gym.publicCode,
        status: link.gym.status,
        isActive: link.isActive && link.status === 'ACTIVE' && link.gym.status === 'ACTIVE',
        joinedAt: link.joinedAt.toISOString(),
      })),
    }
  })
  app.get('/api/members', { preHandler: [requireAuth, requirePermission('members:read')] }, async (req) => {
    const { page, limit, search } = parsePagination(req.query as Record<string, unknown>)
    const principal = getPrincipal(req)
    const where = {
      gymMemberships: { some: { gymId: principal.gymId, isActive: true, deletedAt: null } },
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { code: { contains: search, mode: 'insensitive' as const } },
              { documentNumber: { contains: search } },
            ],
          }
        : {}),
    }
    const [items, total] = await Promise.all([
      prisma.member.findMany({
        where,
        include: { memberships: { where: activeMembershipWhere(principal.gymId), take: 1, include: { plan: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.member.count({ where }),
    ])
    return { items: items.map(toDto), total, page, limit }
  })

  app.get('/api/members/me', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    if (principal.role !== 'MEMBER') throw new DomainError('FORBIDDEN', 'Solo socios', 403)
    const activeGymId = principal.activeGymId ?? principal.gymId
    const member = await prisma.member.findUnique({
      where: { id: principal.id },
      include: {
        memberships: { where: activeMembershipWhere(activeGymId), take: 1, include: { plan: true } },
        nutrition: { where: { deletedAt: null }, take: 1, include: { meals: true } },
      },
    })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
    const membership = member.memberships[0]
    const daysRemaining = membership?.endDate
      ? Math.max(0, Math.ceil((membership.endDate.getTime() - Date.now()) / 86_400_000))
      : 0
    return {
      ...toDto(member),
      daysRemaining,
      nutritionPlan: member.nutrition[0]
        ? {
            title: member.nutrition[0].title,
            calories: member.nutrition[0].calories,
            proteinG: member.nutrition[0].proteinG,
            carbsG: member.nutrition[0].carbsG,
            fatG: member.nutrition[0].fatG,
            meals: member.nutrition[0].meals,
          }
        : null,
    }
  })

  app.get('/api/members/:id/medical', { preHandler: [requireAuth, requirePermission('members:medical:read')] }, async (req) => {
    const { id } = req.params as { id: string }
    const member = await prisma.member.findFirst({ where: { id, deletedAt: null } })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
    await assertActiveGymMembership(member.id, getPrincipal(req).gymId)
    return {
      medicalNotes: decryptOptional(member.medicalNotesCipher),
      allergies: decryptOptional(member.allergiesCipher),
      conditions: decryptOptional(member.conditionsCipher),
    }
  })

  app.get('/api/members/:id/payments', { preHandler: [requireAuth, requirePermission('members:read')] }, async (req) => {
    const { id } = req.params as { id: string }
    const payments = await prisma.payment.findMany({
      where: { memberId: id, gymId: getPrincipal(req).gymId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return payments.map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber,
      amount: p.amountCents / 100,
      method: p.method,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    }))
  })

  app.get('/api/members/:id', { preHandler: [requireAuth, requirePermission('members:read')] }, async (req) => {
    const { id } = req.params as { id: string }
    const gymId = getPrincipal(req).gymId
    const member = await prisma.member.findFirst({
      where: { id, deletedAt: null },
      include: {
        memberships: { where: { plan: { gymId } }, include: { plan: true }, orderBy: { createdAt: 'desc' } },
        payments: { where: { gymId }, orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
    await assertActiveGymMembership(member.id, gymId)
    return {
      ...toDto(member),
      medical: hasPermission(getPrincipal(req).role, 'members:medical:read')
        ? {
            medicalNotes: decryptOptional(member.medicalNotesCipher),
            allergies: decryptOptional(member.allergiesCipher),
            conditions: decryptOptional(member.conditionsCipher),
          }
        : undefined,
      memberships: member.memberships.map((m) => ({
        id: m.id,
        status: m.status,
        planName: m.plan.name,
        startDate: m.startDate?.toISOString() ?? null,
        endDate: m.endDate?.toISOString() ?? null,
      })),
      payments: member.payments.map((p) => ({
        id: p.id,
        receiptNumber: p.receiptNumber,
        amount: p.amountCents / 100,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
    }
  })

  app.post('/api/members', { preHandler: [requireAuth, requirePermission('members:write')] }, async (req, reply) => {
    const body = parse(createMemberSchema, req.body)
    const principal = getPrincipal(req)
    const count = await prisma.member.count({
      where: { gymMemberships: { some: { gymId: principal.gymId, deletedAt: null } } },
    })
    const code = `LUD-${String(count + 1).padStart(6, '0')}`
    const temporaryPassword = generateTemporaryPassword()
    const member = await prisma.member.create({
      data: {
        gymId: principal.gymId,
        code,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email.toLowerCase(),
        phone: body.phone,
        documentNumber: body.document,
        birthDate: new Date(body.birthDate),
        medicalNotesCipher: encryptOptional(body.medicalNotes),
        allergiesCipher: encryptOptional(body.allergies),
        conditionsCipher: encryptOptional(body.conditions),
        passwordHash: hashPassword(temporaryPassword),
        status: 'PENDING',
        gymMemberships: { create: { gymId: principal.gymId } },
      },
    })
    await issueVerification({
      kind: 'member',
      id: member.id,
      email: member.email,
      name: `${member.firstName} ${member.lastName}`,
      platform: 'mobile',
    })
    await writeAudit({
      gymId: principal.gymId,
      actorId: principal.id,
      actorRole: principal.role,
      action: 'member.create',
      entity: 'member',
      entityId: member.id,
    })
    reply.code(201)
    // Se entrega una sola vez al staff para que se la pase al socio.
    return { ...toDto(member), temporaryPassword }
  })

  app.patch('/api/members/:id', { preHandler: [requireAuth, requirePermission('members:write')] }, async (req) => {
    const { id } = req.params as { id: string }
    const body = parse(updateSchema, req.body)
    const principal = getPrincipal(req)
    const before = await prisma.member.findFirst({ where: { id, deletedAt: null } })
    if (!before) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
    await assertActiveGymMembership(before.id, principal.gymId)
    const emailChanged = Boolean(body.email && body.email.toLowerCase() !== before.email.toLowerCase())
    const member = await prisma.member.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email?.toLowerCase(),
        phone: body.phone,
        documentNumber: body.document,
        status: body.status,
        medicalNotesCipher: body.medicalNotes !== undefined ? encryptOptional(body.medicalNotes) : undefined,
        allergiesCipher: body.allergies !== undefined ? encryptOptional(body.allergies) : undefined,
        conditionsCipher: body.conditions !== undefined ? encryptOptional(body.conditions) : undefined,
        ...(emailChanged
          ? { emailVerified: false, emailVerifiedAt: null, verificationTokenHash: null, verificationExpiresAt: null }
          : {}),
      },
    })
    if (emailChanged) {
      await issueVerification({
        kind: 'member',
        id: member.id,
        email: member.email,
        name: `${member.firstName} ${member.lastName}`,
        platform: 'mobile',
      })
    }
    await writeAudit({
      gymId: principal.gymId,
      actorId: principal.id,
      actorRole: principal.role,
      action: 'member.update',
      entity: 'member',
      entityId: id,
      before: { status: before.status, email: before.email },
      after: { status: member.status, email: member.email },
    })
    return toDto(member)
  })
}
