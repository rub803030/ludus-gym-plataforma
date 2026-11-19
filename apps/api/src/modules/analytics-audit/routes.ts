import type { FastifyInstance } from 'fastify'
import { prisma } from '../../shared/database/prisma.js'
import { getPrincipal } from '../../shared/middleware/request-context.js'
import { requirePermission } from '../../shared/middleware/rbac.js'
import { requireAuth } from '../../shared/http.js'

export async function registerAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/reports/summary', { preHandler: [requireAuth, requirePermission('reports:financial')] }, async (req) => {
    const gymId = getPrincipal(req).gymId
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const in30Days = new Date(Date.now() + 30 * 86_400_000)

    const [todayPayments, activeMembers, expiring, occupancy, revenueAll] = await Promise.all([
      prisma.payment.aggregate({
        where: { gymId, status: 'PAID', createdAt: { gte: startOfDay } },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.member.count({ where: { gymId, status: 'ACTIVE', deletedAt: null } }),
      prisma.membership.count({ where: { status: 'ACTIVE', endDate: { lte: in30Days } } }),
      prisma.accessEvent.count({ where: { gymId, createdAt: { gte: startOfDay }, result: { in: ['GRANTED', 'OFFLINE_GRANTED'] } } }),
      prisma.payment.aggregate({ where: { gymId, status: 'PAID' }, _sum: { amountCents: true } }),
    ])
    const gym = await prisma.gym.findUnique({ where: { id: gymId } })

    return {
      todayRevenue: (todayPayments._sum.amountCents ?? 0) / 100,
      todayCharges: todayPayments._count,
      activeMembers,
      expiringSoon: expiring,
      occupancy,
      capacity: gym?.capacity ?? 0,
      totalRevenue: (revenueAll._sum.amountCents ?? 0) / 100,
      generatedAt: new Date().toISOString(),
    }
  })

  app.get('/api/audit-logs', { preHandler: [requireAuth, requirePermission('audit:read')] }, async (req) => {
    const query = req.query as Record<string, unknown>
    const logs = await prisma.auditLog.findMany({
      where: {
        gymId: getPrincipal(req).gymId,
        ...(query['entity'] ? { entity: String(query['entity']) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return logs.map((l) => ({
      id: l.id.toString(),
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      actorRole: l.actorRole,
      before: l.before,
      after: l.after,
      createdAt: l.createdAt.toISOString(),
    }))
  })

  app.get('/api/reports/cash', { preHandler: [requireAuth, requirePermission('payments:audit')] }, async (req) => {
    const sessions = await prisma.cashSession.findMany({
      where: { gymId: getPrincipal(req).gymId },
      include: { movements: { orderBy: { createdAt: 'asc' } } },
      orderBy: { openedAt: 'desc' },
      take: 20,
    })
    return sessions.map((s) => ({
      id: s.id,
      status: s.status,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      opening: s.openingAmountCents / 100,
      closing: s.closingAmountCents ? s.closingAmountCents / 100 : null,
      movements: s.movements.map((m) => ({
        id: m.id,
        kind: m.kind,
        amount: m.amountCents / 100,
        concept: m.concept,
        createdAt: m.createdAt.toISOString(),
      })),
    }))
  })

  app.get('/api/inventory', { preHandler: requireAuth }, async (req) => {
    const items = await prisma.inventoryItem.findMany({
      where: { gymId: getPrincipal(req).gymId, deletedAt: null },
      orderBy: { name: 'asc' },
    })
    return items.map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      quantity: i.quantity,
      reorderLevel: i.reorderLevel,
    }))
  })
}
