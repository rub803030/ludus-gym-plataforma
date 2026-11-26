import Fastify, { type FastifyRequest } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Principal } from '@ludus/shared'
import { registerMemberRoutes } from '../../src/modules/members/routes.js'
import { DomainError } from '../../src/shared/errors/domain-error.js'

const mocks = vi.hoisted(() => ({
  principal: { id: 'staff-id', role: 'OWNER', platform: 'web', gymId: 'gym-id' },
  prisma: {
    gym: { findFirst: vi.fn() },
    member: { findFirst: vi.fn(), findUnique: vi.fn() },
    gymMembership: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  memberCreate: vi.fn(),
  memberUpdate: vi.fn(),
  memberFindUnique: vi.fn(),
  memberFindUniqueOrThrow: vi.fn(),
  gymMembershipCreate: vi.fn(),
  gymMembershipUpsert: vi.fn(),
  issueVerification: vi.fn(),
  issueMemberSession: vi.fn(),
  verifyEnrollmentQr: vi.fn(),
  writeAudit: vi.fn(),
}))

vi.mock('../../src/shared/database/prisma.js', () => ({ prisma: mocks.prisma }))
vi.mock('../../src/shared/http.js', () => ({
  requireAuth: async (req: FastifyRequest) => {
    req.principal = mocks.principal as Principal
  },
  parsePagination: () => ({ page: 1, limit: 20 }),
}))
vi.mock('../../src/shared/middleware/rbac.js', () => ({
  requirePermission: () => async () => {},
}))
vi.mock('../../src/shared/crypto.js', () => ({
  decryptOptional: vi.fn(),
  encryptOptional: vi.fn(),
}))
vi.mock('../../src/shared/password.js', () => ({
  generateTemporaryPassword: () => 'temporary-password',
  hashPassword: () => 'password-hash',
}))
vi.mock('../../src/shared/audit.js', () => ({ writeAudit: mocks.writeAudit }))
vi.mock('../../src/modules/auth/email-verification.js', () => ({
  issueVerification: mocks.issueVerification,
  verificationResponse: vi.fn(),
}))
vi.mock('../../src/modules/auth/auth-service.js', () => ({
  issueMemberSession: mocks.issueMemberSession,
}))
vi.mock('../../src/shared/gym-qr.js', () => ({ verifyEnrollmentQr: mocks.verifyEnrollmentQr }))

describe('POST /api/members', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    vi.clearAllMocks()
    const now = new Date('2026-01-15T12:00:00.000Z')
    const createdMember = {
      id: 'member-id',
      code: 'LUD-123456',
      firstName: 'Ana',
      lastName: 'Lopez',
      email: 'ana@example.com',
      phone: '5551234567',
      documentNumber: 'DOC123456',
      status: 'PENDING',
      emailVerified: false,
      joinedAt: now,
      createdAt: now,
      gymMemberships: [{ status: 'ACTIVE' }],
      memberships: [],
    }

    mocks.prisma.member.findFirst.mockResolvedValue(null)
    mocks.memberCreate.mockResolvedValue(createdMember)
    mocks.memberFindUniqueOrThrow.mockResolvedValue(createdMember)
    mocks.gymMembershipCreate.mockResolvedValue({ id: 'gym-membership-id' })
    mocks.issueVerification.mockResolvedValue({ token: 'verification-token' })
    mocks.writeAudit.mockResolvedValue(undefined)
    mocks.prisma.$transaction.mockImplementation((work) =>
      work({
        member: {
          create: mocks.memberCreate,
          update: mocks.memberUpdate,
          findUnique: mocks.memberFindUnique,
          findUniqueOrThrow: mocks.memberFindUniqueOrThrow,
        },
        gymMembership: {
          create: mocks.gymMembershipCreate,
          upsert: mocks.gymMembershipUpsert,
        },
      }),
    )

    app = Fastify()
    await app.register(registerMemberRoutes)
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('creates the member and active gym affiliation within one transaction', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/members',
      payload: {
        firstName: 'Ana',
        lastName: 'Lopez',
        email: 'Ana@Example.com',
        document: 'DOC123456',
        phone: '5551234567',
        birthDate: '2000-01-01',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mocks.memberCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ gymId: 'gym-id', status: 'PENDING' }),
    })
    expect(mocks.gymMembershipCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gymId: 'gym-id',
        memberId: 'member-id',
        status: 'ACTIVE',
        isActive: true,
      }),
    })
  })

  it('creates the member affiliation transactionally when joining a gym from mobile', async () => {
    mocks.principal.role = 'MEMBER'
    mocks.principal.platform = 'mobile'
    mocks.verifyEnrollmentQr.mockImplementation(() => {
      throw new DomainError('INVALID_ENROLLMENT_CODE', 'Public code, not a signed QR', 400)
    })
    mocks.prisma.gym.findFirst.mockResolvedValue({
      id: 'gym-id',
      name: 'Ludus Centro',
      publicCode: 'PUBLIC123',
      status: 'ACTIVE',
      deletedAt: null,
    })
    mocks.prisma.member.findUnique.mockResolvedValue({
      id: 'member-id',
      gymId: null,
      status: 'ACTIVE',
    })
    mocks.prisma.gymMembership.findUnique.mockResolvedValue(null)
    mocks.gymMembershipUpsert.mockResolvedValue({ id: 'gym-membership-id' })
    mocks.memberUpdate.mockResolvedValue({ id: 'member-id', gymId: 'gym-id' })
    mocks.issueMemberSession.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/members/join-gym',
      payload: { code: 'PUBLIC123' },
    })

    expect(response.statusCode, response.body).toBe(200)
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mocks.gymMembershipUpsert).toHaveBeenCalledWith({
      where: { gymId_memberId: { gymId: 'gym-id', memberId: 'member-id' } },
      create: expect.objectContaining({
        gymId: 'gym-id',
        memberId: 'member-id',
        status: 'ACTIVE',
        isActive: true,
      }),
      update: expect.objectContaining({ status: 'ACTIVE', isActive: true, deletedAt: null }),
    })
    expect(mocks.issueMemberSession).toHaveBeenCalledWith('member-id', 'gym-id', 'ludus-android')
  })
})
