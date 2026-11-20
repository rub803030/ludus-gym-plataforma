import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createMemberSchema, hasPermission } from '@ludus/shared'
import { prisma } from '../../shared/database/prisma.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { getPrincipal } from '../../shared/middleware/request-context.js'
import { requirePermission } from '../../shared/middleware/rbac.js'
import { requireAuth, parsePagination } from '../../shared/http.js'
import { decryptOptional, encryptOptional } from '../../shared/crypto.js'
import { generateTemporaryPassword, hashPassword } from '../../shared/password.js'
import { writeAudit } from '../../shared/audit.js'
import { issueVerification } from '../auth/email-verification.js'

const updateSchema = createMemberSchema.partial().extend({ status: z.enum(['ACTIVE', 'PENDING', 'EXPIRED', 'SUSPENDED']).optional() })

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new DomainError('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'Datos inválidos', 400)
  return result.data
}

function toDto(member: {
  id: string; code: string; firstName: string; lastName: string; email: string; phone: string
  documentNumber: string; status: string; joinedAt: Date; createdAt: Date; emailVerified?: boolean
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
    phone: member.phone,
    document: member.documentNumber,
    status: member.status,
    emailVerified: member.emailVerified ?? false,
    joinedAt: member.joinedAt.toISOString(),
    createdAt: member.createdAt.toISOString(),
    membership: active
      ? { planName: active.plan.name, endDate: active.endDate?.toISOString() ?? null, status: active.status }
      : null,
  }
}

export async function registerMemberRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/members', { preHandler: [requireAuth, requirePermission('members:read')] }, async (req) => {
    const { page, limit, search } = parsePagination(req.query as Record<string, unknown>)
    const principal = getPrincipal(req)
    const where = {
      gymId: principal.gymId,
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
        include: { memberships: { where: { status: 'ACTIVE' }, take: 1, include: { plan: true } } },
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
    const member = await prisma.member.findUnique({
      where: { id: principal.id },
      include: {
        memberships: { where: { status: 'ACTIVE' }, take: 1, include: { plan: true } },
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
    const member = await prisma.member.findFirst({ where: { id, gymId: getPrincipal(req).gymId } })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
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
    const member = await prisma.member.findFirst({
      where: { id, gymId: getPrincipal(req).gymId, deletedAt: null },
      include: {
        memberships: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
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
    const count = await prisma.member.count({ where: { gymId: principal.gymId } })
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
    const before = await prisma.member.findFirst({ where: { id, gymId: principal.gymId } })
    if (!before) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
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
