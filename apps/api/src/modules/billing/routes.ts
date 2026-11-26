import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { chargeSchema } from '@ludus/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../../shared/database/prisma.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { getPrincipal } from '../../shared/middleware/request-context.js'
import { requirePermission } from '../../shared/middleware/rbac.js'
import { requireAuth } from '../../shared/http.js'
import { idempotencyGuard } from '../../shared/middleware/idempotency.js'
import { setTenantContext } from '../../shared/database/tenant-context.js'
import { writeAudit } from '../../shared/audit.js'
import { memberGymScope } from '../../shared/gym-membership.js'
import { membershipPeriod } from './membership-period.js'

const planFlagSchema = z.enum(['gym_access', 'classes', 'nutrition', 'guest_pass'])

const planSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  durationDays: z.number().int().positive(),
  price: z.number().positive(),
  includesClasses: z.boolean().optional(),
  includesNutrition: z.boolean().optional(),
  flags: z.array(planFlagSchema).optional(),
  active: z.boolean().optional(),
  currency: z.literal('MXN').optional(),
})

type PlanBody = z.infer<typeof planSchema>

function planBenefits(body: PlanBody) {
  return {
    includesClasses: body.includesClasses ?? body.flags?.includes('classes') ?? false,
    includesNutrition: body.includesNutrition ?? body.flags?.includes('nutrition') ?? false,
  }
}

function planFlags(plan: { includesClasses: boolean; includesNutrition: boolean }): string[] {
  const flags = ['gym_access']
  if (plan.includesClasses) flags.push('classes')
  if (plan.includesNutrition) flags.push('nutrition')
  return flags
}

const shiftSchema = z.object({
  openingAmount: z.number().min(0).optional(),
  startingAmount: z.number().min(0).optional(),
})
const closeSchema = z.object({
  closingAmount: z.number().min(0).optional(),
  countedAmount: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
})
const refundSchema = z.object({ reason: z.string().min(5).max(300) })

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new DomainError('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'Datos inválidos', 400)
  return result.data
}

type ChargeBody = z.infer<typeof chargeSchema>

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function chargeResponse(
  payment: { id: string; receiptNumber: string; amountCents: number; method: string; status: string; createdAt: Date },
  member: { id: string; firstName: string; lastName: string },
  plan: { name: string },
) {
  return {
    id: payment.id,
    receiptNumber: payment.receiptNumber,
    amount: payment.amountCents / 100,
    method: payment.method,
    status: payment.status,
    createdAt: payment.createdAt.toISOString(),
    member: { id: member.id, name: `${member.firstName} ${member.lastName}` },
    plan: plan.name,
    accessQrHint: 'Pide al socio que muestre su QR dinámico en el torniquete',
  }
}

async function findIdempotentCharge(gymId: string, idempotencyKey: string, body: ChargeBody) {
  return prisma.$transaction(async (tx) => {
    await setTenantContext(tx, gymId)
    const payment = await tx.payment.findFirst({ where: { gymId, idempotencyKey } })
    if (!payment) return null
    if (
      payment.memberId !== body.memberId ||
      payment.planId !== body.planId ||
      payment.method !== body.method ||
      payment.currency !== body.currency
    ) {
      throw new DomainError('CONFLICT', 'La clave de idempotencia ya se usó para otro cobro', 409)
    }
    const [member, plan] = await Promise.all([
      tx.member.findUnique({ where: { id: payment.memberId } }),
      tx.plan.findFirst({ where: { id: payment.planId, gymId } }),
    ])
    if (!member || !plan) throw new DomainError('NOT_FOUND', 'No se pudo recuperar el cobro procesado', 404)
    return chargeResponse(payment, member, plan)
  })
}

export async function registerBillingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/plans', { preHandler: requireAuth }, async (req) => {
    const plans = await prisma.plan.findMany({
      where: { gymId: getPrincipal(req).gymId, isActive: true, deletedAt: null },
      orderBy: { priceCents: 'asc' },
    })
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      durationDays: p.durationDays,
      price: p.priceCents / 100,
      includesClasses: p.includesClasses,
      includesNutrition: p.includesNutrition,
      flags: planFlags(p),
      active: p.isActive,
      currency: p.currency,
    }))
  })

  app.post('/api/plans', { preHandler: [requireAuth, requirePermission('plans:manage')] }, async (req, reply) => {
    const body = parse(planSchema, req.body)
    const principal = getPrincipal(req)
    const existing = await prisma.plan.findFirst({ where: { gymId: principal.gymId, name: body.name } })
    if (existing) throw new DomainError('CONFLICT', 'Ya existe un plan con ese nombre', 409)
    const plan = await prisma.plan.create({
      data: {
        gymId: principal.gymId,
        name: body.name,
        description: body.description,
        durationDays: body.durationDays,
        priceCents: Math.round(body.price * 100),
        ...planBenefits(body),
        isActive: body.active ?? true,
      },
    })
    reply.code(201)
    return { id: plan.id, name: plan.name, price: plan.priceCents / 100 }
  })

  app.patch('/api/plans/:id', { preHandler: [requireAuth, requirePermission('plans:manage')] }, async (req) => {
    const { id } = req.params as { id: string }
    const body = parse(planSchema.partial(), req.body)
    const principal = getPrincipal(req)
    const owned = await prisma.plan.findFirst({
      where: { id, gymId: principal.gymId, deletedAt: null },
    })
    if (!owned) throw new DomainError('NOT_FOUND', 'Plan no encontrado', 404)
    const benefits = {
      includesClasses: body.includesClasses ?? body.flags?.includes('classes') ?? owned.includesClasses,
      includesNutrition: body.includesNutrition ?? body.flags?.includes('nutrition') ?? owned.includesNutrition,
    }
    const plan = await prisma.plan.update({
      where: { id: owned.id },
      data: {
        name: body.name,
        description: body.description,
        durationDays: body.durationDays,
        priceCents: body.price !== undefined ? Math.round(body.price * 100) : undefined,
        includesClasses: body.includesClasses !== undefined || body.flags !== undefined
          ? benefits.includesClasses
          : undefined,
        includesNutrition: body.includesNutrition !== undefined || body.flags !== undefined
          ? benefits.includesNutrition
          : undefined,
        isActive: body.active,
        currency: body.currency,
      },
    })
    return { id: plan.id, name: plan.name, price: plan.priceCents / 100 }
  })

  app.post(
    '/api/payments/charge',
    { preHandler: [requireAuth, requirePermission('payments:charge'), idempotencyGuard] },
    async (req, reply) => {
      const body = parse(chargeSchema, req.body)
      const principal = getPrincipal(req)
      const idempotencyKey = req.idempotencyKey
      if (!idempotencyKey) {
        throw new DomainError('VALIDATION_ERROR', 'Idempotency-Key requerido', 400)
      }

      const previouslyProcessed = await findIdempotentCharge(principal.gymId, idempotencyKey, body)
      if (previouslyProcessed) {
        reply.code(201)
        return previouslyProcessed
      }

      const createCharge = () => prisma.$transaction(async (tx) => {
          await setTenantContext(tx, principal.gymId)
          const member = await tx.member.findFirst({
            where: { id: body.memberId, deletedAt: null, ...memberGymScope(principal.gymId) },
          })
          if (!member) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
          const plan = await tx.plan.findFirst({ where: { id: body.planId, gymId: principal.gymId } })
          if (!plan) throw new DomainError('NOT_FOUND', 'Plan no encontrado', 404)

          const amountCents = plan.priceCents
          const now = new Date()
          const today = new Date(now.getTime())
          today.setUTCHours(0, 0, 0, 0)
          const receiptYear = now.getUTCFullYear()
          const [receiptCounter] = await tx.$queryRaw<Array<{ last_value: bigint }>>`
            INSERT INTO public.receipt_counters (gym_id, receipt_year, last_value)
            VALUES (${principal.gymId}::uuid, ${receiptYear}, 1)
            ON CONFLICT (gym_id, receipt_year) DO UPDATE
            SET last_value = public.receipt_counters.last_value + 1,
                updated_at = now()
            RETURNING last_value
          `
          if (!receiptCounter) throw new Error('No se pudo asignar el número de recibo')
          const receiptNumber = `LUD-${receiptYear}-${String(Number(receiptCounter.last_value)).padStart(6, '0')}`

          await tx.membership.updateMany({
            where: {
              memberId: member.id,
              status: 'ACTIVE',
              endDate: { lt: today },
              plan: { gymId: principal.gymId },
            },
            data: { status: 'EXPIRED' },
          })
          const existing = await tx.membership.findFirst({
            where: { memberId: member.id, status: 'ACTIVE', plan: { gymId: principal.gymId } },
            orderBy: { endDate: 'desc' },
          })
          const { startDate, endDate } = membershipPeriod(now, existing?.endDate ?? null, plan.durationDays)

          const membership = await tx.membership.create({
            data: {
              memberId: member.id,
              planId: plan.id,
              status: 'ACTIVE',
              startDate,
              endDate,
            },
          })

          let session = await tx.cashSession.findFirst({
            where: { gymId: principal.gymId, status: 'OPEN' },
            orderBy: { openedAt: 'desc' },
          })
          if (!session) {
            session = await tx.cashSession.create({
              data: { gymId: principal.gymId, openedBy: principal.id, openingAmountCents: 0 },
            })
          }

          const payment = await tx.payment.create({
            data: {
              gymId: principal.gymId,
              memberId: member.id,
              membershipId: membership.id,
              planId: plan.id,
              cashSessionId: session.id,
              amountCents,
              method: body.method,
              currency: body.currency,
              status: 'PAID',
              idempotencyKey,
              receiptNumber,
              createdBy: principal.id,
            },
          })

          await tx.cashMovement.create({
            data: {
              cashSessionId: session.id,
              paymentId: payment.id,
              kind: 'INCOME',
              amountCents,
              concept: `Membresía ${plan.name} · ${member.firstName} ${member.lastName}`,
              createdBy: principal.id,
            },
          })
          return { payment, plan, member, sessionId: session.id, amountCents, receiptNumber }
      })
      let result: Awaited<ReturnType<typeof createCharge>>
      try {
        result = await createCharge()
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error
        const duplicate = await findIdempotentCharge(principal.gymId, idempotencyKey, body)
        if (!duplicate) throw error
        reply.code(201)
        return duplicate
      }

      await writeAudit({
        gymId: principal.gymId,
        actorId: principal.id,
        actorRole: principal.role,
        action: 'payment.charge',
        entity: 'payment',
        entityId: result.payment.id,
        after: { amountCents: result.amountCents, receiptNumber: result.receiptNumber },
      })

      reply.code(201)
      return chargeResponse(result.payment, result.member, result.plan)
    },
  )

  app.post('/api/payments/:id/refund', { preHandler: [requireAuth, requirePermission('payments:refund')] }, async (req) => {
    const { id } = req.params as { id: string }
    const body = parse(refundSchema, req.body)
    const principal = getPrincipal(req)

    await prisma.$transaction(async (tx) => {
      await setTenantContext(tx, principal.gymId)
      const payment = await tx.payment.findFirst({ where: { id, gymId: principal.gymId } })
      if (!payment) throw new DomainError('NOT_FOUND', 'Cobro no encontrado', 404)
      if (payment.status !== 'PAID') throw new DomainError('CONFLICT', 'Este cobro no se puede cancelar', 409)
      if (payment.membershipId) {
        const membership = await tx.membership.findFirst({
          where: {
            id: payment.membershipId,
            memberId: payment.memberId,
            status: 'ACTIVE',
            plan: { gymId: principal.gymId },
          },
        })
        if (membership) {
          const otherPaidPayments = await tx.payment.count({
            where: {
              gymId: principal.gymId,
              membershipId: membership.id,
              id: { not: payment.id },
              status: 'PAID',
            },
          })
          if (otherPaidPayments > 0) {
            throw new DomainError('CONFLICT', 'La membresía está vinculada a otros cobros pagados; requiere revisión', 409)
          }
          await tx.membership.update({
            where: { id: membership.id },
            data: { status: 'EXPIRED' },
          })
        }
      } else {
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        const activeMembership = await tx.membership.findFirst({
          where: {
            memberId: payment.memberId,
            planId: payment.planId,
            status: 'ACTIVE',
            startDate: { lte: today },
            endDate: { gte: today },
            plan: { gymId: principal.gymId },
          },
        })
        if (activeMembership) {
          throw new DomainError('CONFLICT', 'Este cobro legado no está vinculado a su membresía; requiere revisión', 409)
        }
      }

      const updated = await tx.payment.updateMany({
        where: { id, gymId: principal.gymId, status: 'PAID' },
        data: { status: 'REFUNDED', refundedBy: principal.id, refundedAt: new Date(), refundReason: body.reason },
      })
      if (updated.count !== 1) throw new DomainError('CONFLICT', 'Este cobro ya fue procesado', 409)
      if (payment.cashSessionId) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: payment.cashSessionId,
            paymentId: payment.id,
            kind: 'REFUND',
            amountCents: -payment.amountCents,
            concept: `Cancelación · ${body.reason}`,
            createdBy: principal.id,
          },
        })
      }
    })
    await writeAudit({
      gymId: principal.gymId,
      actorId: principal.id,
      actorRole: principal.role,
      action: 'payment.refund',
      entity: 'payment',
      entityId: id,
      after: { reason: body.reason },
    })
    return { ok: true, status: 'REFUNDED' }
  })

  app.get('/api/payments', { preHandler: [requireAuth, requirePermission('payments:audit')] }, async (req) => {
    const query = req.query as Record<string, unknown>
    const principal = getPrincipal(req)
    const payments = await prisma.payment.findMany({
      where: {
        gymId: principal.gymId,
        ...(query['memberId'] ? { memberId: String(query['memberId']) } : {}),
      },
      include: { member: { select: { firstName: true, lastName: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return payments.map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber,
      amount: p.amountCents / 100,
      method: p.method,
      status: p.status,
      memberName: `${p.member.firstName} ${p.member.lastName}`,
      memberCode: p.member.code,
      createdAt: p.createdAt.toISOString(),
    }))
  })

  app.get('/api/cash-sessions', { preHandler: [requireAuth, requirePermission('cash:shift:close')] }, async (req) => {
    const sessions = await prisma.cashSession.findMany({
      where: { gymId: getPrincipal(req).gymId },
      orderBy: { openedAt: 'desc' },
      take: 30,
      include: { _count: { select: { movements: true } } },
    })
    return sessions.map((s) => ({
      id: s.id,
      status: s.status,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      openingAmount: s.openingAmountCents / 100,
      closingAmount: s.closingAmountCents ? s.closingAmountCents / 100 : null,
      movements: s._count.movements,
    }))
  })

  const openShift = async (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
    const body = parse(shiftSchema, req.body ?? {})
    const principal = getPrincipal(req)
    const open = await prisma.cashSession.findFirst({ where: { gymId: principal.gymId, status: 'OPEN' } })
    if (open) {
      reply.code(200)
      return { id: open.id, openedAt: open.openedAt.toISOString(), alreadyOpen: true }
    }
    const session = await prisma.cashSession.create({
      data: {
        gymId: principal.gymId,
        openedBy: principal.id,
        openingAmountCents: Math.round((body.openingAmount ?? body.startingAmount ?? 0) * 100),
      },
    })
    reply.code(201)
    return { id: session.id, openedAt: session.openedAt.toISOString() }
  }
  const openShiftOpts = { preHandler: [requireAuth, requirePermission('cash:shift:open')] }
  app.post('/api/cash-sessions', openShiftOpts, openShift)
  app.post('/api/cash-sessions/open', openShiftOpts, openShift)

  app.post('/api/cash-sessions/:id/close', { preHandler: [requireAuth, requirePermission('cash:shift:close')] }, async (req) => {
    const { id } = req.params as { id: string }
    const body = parse(closeSchema, req.body)
    const session = await prisma.cashSession.findFirst({ where: { id, gymId: getPrincipal(req).gymId } })
    if (!session) throw new DomainError('NOT_FOUND', 'Turno no encontrado', 404)
    const updated = await prisma.cashSession.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy: getPrincipal(req).id,
        closingAmountCents: Math.round((body.closingAmount ?? body.countedAmount ?? 0) * 100),
        notes: body.notes,
      },
    })
    return { id: updated.id, status: updated.status, closedAt: updated.closedAt?.toISOString() }
  })

  app.delete('/api/plans/:id', { preHandler: [requireAuth, requirePermission('plans:manage')] }, async (req) => {
    const { id } = req.params as { id: string }
    const principal = getPrincipal(req)
    const plan = await prisma.plan.findFirst({ where: { id, gymId: principal.gymId } })
    if (!plan) throw new DomainError('NOT_FOUND', 'Plan no encontrado', 404)
    await prisma.plan.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } })
    await writeAudit({
      gymId: principal.gymId,
      actorId: principal.id,
      actorRole: principal.role,
      action: 'plan.archive',
      entity: 'plan',
      entityId: id,
    })
    return { ok: true, id }
  })
}
