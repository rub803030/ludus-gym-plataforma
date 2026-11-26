import { describe, expect, it } from 'vitest'
import { memberAccessDenial, type MemberAccessState } from '../../src/shared/member-access.js'

const today = new Date('2026-11-26T12:00:00.000Z')
const gymA = '00000000-0000-7000-8000-000000000001'
const gymB = '00000000-0000-7000-8000-000000000002'

function state(overrides: Partial<MemberAccessState> = {}): MemberAccessState {
  return {
    memberStatus: 'ACTIVE',
    affiliation: { status: 'ACTIVE', isActive: true, deletedAt: null },
    memberships: [{
      status: 'ACTIVE',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      endDate: new Date('2026-11-30T00:00:00.000Z'),
      plan: { gymId: gymA },
    }],
    ...overrides,
  }
}

describe('memberAccessDenial', () => {
  it('permite el acceso solo con cuenta, afiliación y plan vigente en el mismo gimnasio', () => {
    expect(memberAccessDenial(state(), gymA, today)).toBeNull()
    expect(memberAccessDenial(state(), gymB, today)?.code).toBe('NO_MEMBERSHIP')
  })

  it('deniega una cuenta suspendida globalmente', () => {
    expect(memberAccessDenial(state({ memberStatus: 'SUSPENDED' }), gymA, today)?.code).toBe('USER_INACTIVE')
  })

  it('deniega una afiliación suspendida aunque conserve un plan activo', () => {
    expect(
      memberAccessDenial(
        state({ affiliation: { status: 'SUSPENDED', isActive: false, deletedAt: null } }),
        gymA,
        today,
      )?.code,
    ).toBe('GYM_MEMBERSHIP_SUSPENDED')
  })

  it('distingue entre ausencia, vigencia futura y membresía vencida', () => {
    expect(memberAccessDenial(state({ memberships: [] }), gymA, today)?.code).toBe('NO_MEMBERSHIP')
    expect(
      memberAccessDenial(
        state({
          memberships: [{
            status: 'ACTIVE',
            startDate: new Date('2026-11-27T00:00:00.000Z'),
            endDate: new Date('2026-12-01T00:00:00.000Z'),
            plan: { gymId: gymA },
          }],
        }),
        gymA,
        today,
      )?.code,
    ).toBe('MEMBERSHIP_NOT_STARTED')
    expect(
      memberAccessDenial(
        state({
          memberships: [{
            status: 'ACTIVE',
            startDate: new Date('2026-10-01T00:00:00.000Z'),
            endDate: new Date('2026-11-25T00:00:00.000Z'),
            plan: { gymId: gymA },
          }],
        }),
        gymA,
        today,
      )?.code,
    ).toBe('MEMBERSHIP_EXPIRED')
  })
})
