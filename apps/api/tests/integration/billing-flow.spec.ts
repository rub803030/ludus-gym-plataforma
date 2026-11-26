import Fastify, { type FastifyRequest } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Principal } from '@ludus/shared'
import { registerBillingRoutes } from '../../src/modules/billing/routes.js'

const mocks = vi.hoisted(() => ({
  principal: {
    id: '00000000-0000-4000-8000-000000000007',
    role: 'OWNER',
    platform: 'web',
    gymId: '00000000-0000-4000-8000-000000000001',
  },
  prisma: {
    $transaction: vi.fn(),
    member: { findUnique: vi.fn() },
    plan: { findFirst: vi.fn() },
    payment: { findFirst: vi.fn() },
  },
  tx: {
    $queryRaw: vi.fn(),
    member: { findFirst: vi.fn(), findUnique: vi.fn() },
    plan: { findFirst: vi.fn() },
    membership: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    cashSession: { findFirst: vi.fn(), create: vi.fn() },
    payment: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
    cashMovement: { create: vi.fn() },
  },
  writeAudit: vi.fn(),
}))

vi.mock('../../src/shared/database/prisma.js', () => ({ prisma: mocks.prisma }))
vi.mock('../../src/shared/http.js', () => ({
  requireAuth: async (req: FastifyRequest) => {
    req.principal = mocks.principal as Principal
  },
}))
vi.mock('../../src/shared/middleware/rbac.js', () => ({
  requirePermission: () => async () => {},
}))
vi.mock('../../src/shared/audit.js', () => ({ writeAudit: mocks.writeAudit }))

describe('billing flow', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()
    const now = new Date('2026-04-04T12:00:00.000Z')
    const member = {
      id: '00000000-0000-4000-8000-000000000002',
      firstName: 'Ana',
      lastName: 'Lopez',
      status: 'ACTIVE',
      deletedAt: null,
    }
    const plan = {
      id: '00000000-0000-4000-8000-000000000003',
      gymId: '00000000-0000-4000-8000-000000000001',
      name: 'Mensual',
      priceCents: 15900,
      durationDays: 30,
      isActive: true,
    }
    const payment = {
      id: '00000000-0000-4000-8000-000000000004',
      gymId: '00000000-0000-4000-8000-000000000001',
      memberId: '00000000-0000-4000-8000-000000000002',
      membershipId: '00000000-0000-4000-8000-000000000005',
      planId: '00000000-0000-4000-8000-000000000003',
      amountCents: 15900,
      currency: 'MXN',
      method: 'cash',
      status: 'PAID',
      idempotencyKey: 'idempotency-key-0001',
      receiptNumber: `LUD-${now.getUTCFullYear()}-000001`,
      createdAt: now,
      cashSessionId: '00000000-0000-4000-8000-000000000006',
    }

    mocks.tx.$queryRaw.mockResolvedValue([{ last_value: 1n }])
    mocks.tx.member.findFirst.mockResolvedValue(member)
    mocks.tx.member.findUnique.mockResolvedValue(member)
    mocks.tx.plan.findFirst.mockResolvedValue(plan)
    mocks.tx.membership.findFirst.mockResolvedValue(null)
    mocks.tx.membership.create.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000005' })
    mocks.tx.membership.update.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000005', status: 'EXPIRED' })
    mocks.tx.membership.updateMany.mockResolvedValue({ count: 0 })
    mocks.tx.cashSession.findFirst.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000006' })
    mocks.tx.cashSession.create.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000006' })
    mocks.tx.payment.findFirst.mockResolvedValue(null)
    mocks.tx.payment.create.mockResolvedValue(payment)
    mocks.tx.payment.count.mockResolvedValue(0)
    mocks.tx.payment.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.cashMovement.create.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000008' })
    mocks.prisma.$transaction.mockImplementation((work) => work(mocks.tx))
    mocks.prisma.payment.findFirst.mockResolvedValue(null)
    mocks.prisma.member.findUnique.mockResolvedValue(member)
    mocks.prisma.plan.findFirst.mockResolvedValue(plan)
    mocks.writeAudit.mockResolvedValue(undefined)

    app = Fastify()
    await app.register(registerBillingRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  const charge = (key = 'idempotency-key-0001') => app.inject({
    method: 'POST',
    url: '/api/payments/charge',
    headers: { 'idempotency-key': key },
    payload: {
      memberId: '00000000-0000-4000-8000-000000000002',
      planId: '00000000-0000-4000-8000-000000000003',
      amount: 1,
      currency: 'MXN',
      method: 'cash',
      idempotencyKey: key,
    },
  })

  it('uses the server plan price and creates a payment-specific membership', async () => {
    const response = await charge()

    expect(response.statusCode, response.body).toBe(201)
    expect(response.json().amount).toBe(159)
    expect(mocks.tx.membership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        memberId: '00000000-0000-4000-8000-000000000002',
        planId: '00000000-0000-4000-8000-000000000003',
        status: 'ACTIVE',
      }),
    })
    expect(mocks.tx.membership.update).not.toHaveBeenCalled()
    expect(mocks.tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountCents: 15900,
        membershipId: '00000000-0000-4000-8000-000000000005',
        receiptNumber: `LUD-${new Date().getUTCFullYear()}-000001`,
      }),
    })
  })

  it('returns the existing result for a matching idempotency key', async () => {
    mocks.tx.payment.findFirst.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000004',
      memberId: '00000000-0000-4000-8000-000000000002',
      planId: '00000000-0000-4000-8000-000000000003',
      method: 'cash',
      currency: 'MXN',
      amountCents: 15900,
      status: 'PAID',
      receiptNumber: 'LUD-2026-000001',
      createdAt: new Date('2026-04-04T12:00:00.000Z'),
    })

    const response = await charge()

    expect(response.statusCode).toBe(201)
    expect(response.json().id).toBe('00000000-0000-4000-8000-000000000004')
    expect(mocks.tx.payment.create).not.toHaveBeenCalled()
  })

  it('rejects reusing a key for a different charge', async () => {
    mocks.tx.payment.findFirst.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000004',
      memberId: '00000000-0000-4000-8000-000000000009',
      planId: '00000000-0000-4000-8000-000000000003',
      method: 'cash',
      currency: 'MXN',
    })

    const response = await charge()

    expect(response.statusCode).toBe(409)
    expect(mocks.tx.payment.create).not.toHaveBeenCalled()
  })

  it('allows the same idempotency key to retry after a failed transaction', async () => {
    mocks.tx.payment.create.mockRejectedValueOnce(new Error('temporary database failure'))

    const failed = await charge()
    const retried = await charge()

    expect(failed.statusCode).toBe(500)
    expect(retried.statusCode).toBe(201)
    expect(mocks.tx.payment.create).toHaveBeenCalledTimes(2)
  })

  it('expires the associated membership in the refund transaction', async () => {
    mocks.tx.payment.findFirst.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000004',
      gymId: '00000000-0000-4000-8000-000000000001',
      memberId: '00000000-0000-4000-8000-000000000002',
      membershipId: '00000000-0000-4000-8000-000000000005',
      planId: '00000000-0000-4000-8000-000000000003',
      amountCents: 15900,
      status: 'PAID',
      cashSessionId: '00000000-0000-4000-8000-000000000006',
    })
    mocks.tx.membership.findFirst.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000005' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/00000000-0000-4000-8000-000000000004/refund',
      payload: { reason: 'Devolución solicitada' },
    })

    expect(response.statusCode).toBe(200)
    expect(mocks.tx.membership.update).toHaveBeenCalledWith({
      where: { id: '00000000-0000-4000-8000-000000000005' },
      data: { status: 'EXPIRED' },
    })
    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: '00000000-0000-4000-8000-000000000004',
        gymId: '00000000-0000-4000-8000-000000000001',
        status: 'PAID',
      },
      data: expect.objectContaining({ status: 'REFUNDED' }),
    })
  })

  it('blocks refunding a legacy payment that still backs an active membership', async () => {
    mocks.tx.payment.findFirst.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000004',
      gymId: '00000000-0000-4000-8000-000000000001',
      memberId: '00000000-0000-4000-8000-000000000002',
      membershipId: null,
      planId: '00000000-0000-4000-8000-000000000003',
      amountCents: 15900,
      status: 'PAID',
      cashSessionId: 'cash-session-id',
    })
    mocks.tx.membership.findFirst.mockResolvedValue({ id: 'legacy-membership-id' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/00000000-0000-4000-8000-000000000004/refund',
      payload: { reason: 'Devolución solicitada' },
    })

    expect(response.statusCode).toBe(409)
    expect(mocks.tx.payment.updateMany).not.toHaveBeenCalled()
  })

  it('blocks refund when another paid charge shares the membership', async () => {
    mocks.tx.payment.findFirst.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000004',
      gymId: '00000000-0000-4000-8000-000000000001',
      memberId: '00000000-0000-4000-8000-000000000002',
      membershipId: '00000000-0000-4000-8000-000000000005',
      planId: '00000000-0000-4000-8000-000000000003',
      amountCents: 15900,
      status: 'PAID',
      cashSessionId: '00000000-0000-4000-8000-000000000006',
    })
    mocks.tx.membership.findFirst.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000005' })
    mocks.tx.payment.count.mockResolvedValue(1)

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/00000000-0000-4000-8000-000000000004/refund',
      payload: { reason: 'Devolución solicitada' },
    })

    expect(response.statusCode).toBe(409)
    expect(mocks.tx.membership.update).not.toHaveBeenCalled()
    expect(mocks.tx.payment.updateMany).not.toHaveBeenCalled()
  })
})
