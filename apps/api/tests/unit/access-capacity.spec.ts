import type { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { assertGymCapacity } from '../../src/modules/access/access-capacity.js'

function transaction(capacity: number, occupancy: number) {
  const queryRaw = vi.fn().mockResolvedValue([{ id: 'gym-id' }])
  const count = vi.fn().mockResolvedValue(occupancy)
  const tx = {
    $queryRaw: queryRaw,
    gym: {
      findUnique: vi.fn().mockResolvedValue({
        capacity,
        status: 'ACTIVE',
        deletedAt: null,
      }),
    },
    accessEvent: { count },
  } as unknown as Prisma.TransactionClient
  return { tx, queryRaw, count }
}

describe('gym access capacity', () => {
  it('sets tenant context and locks the gym before counting admissions', async () => {
    const { tx, queryRaw, count } = transaction(2, 1)

    await assertGymCapacity(tx, 'gym-id', new Date('2026-04-04T12:00:00.000Z'))

    expect(queryRaw).toHaveBeenCalledTimes(2)
    expect(queryRaw.mock.invocationCallOrder[1]).toBeLessThan(count.mock.invocationCallOrder[0])
  })

  it('rejects admission when the limit is already reached', async () => {
    const { tx } = transaction(1, 1)

    await expect(assertGymCapacity(tx, 'gym-id')).rejects.toMatchObject({
      code: 'DENIED_CAPACITY',
      status: 409,
    })
  })
})
