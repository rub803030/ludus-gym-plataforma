import type { Prisma } from '@prisma/client'
import { DomainError } from '../../shared/errors/domain-error.js'
import { setTenantContext } from '../../shared/database/tenant-context.js'

export async function assertGymCapacity(
  tx: Prisma.TransactionClient,
  gymId: string,
  now = new Date(),
): Promise<void> {
  await setTenantContext(tx, gymId)
  const lockedGym = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM public.gyms
    WHERE id = ${gymId}::uuid
    FOR UPDATE
  `
  if (lockedGym.length === 0) throw new DomainError('NOT_FOUND', 'Gimnasio no encontrado', 404)

  const gym = await tx.gym.findUnique({
    where: { id: gymId },
    select: { capacity: true, status: true, deletedAt: true },
  })
  if (!gym || gym.deletedAt) throw new DomainError('NOT_FOUND', 'Gimnasio no encontrado', 404)
  if (gym.status !== 'ACTIVE') {
    throw new DomainError('GYM_NOT_ACTIVE', 'Este gimnasio todavía no está activo', 403)
  }

  const startOfDay = new Date(now.getTime())
  startOfDay.setUTCHours(0, 0, 0, 0)
  const occupancy = await tx.accessEvent.count({
    where: {
      gymId,
      createdAt: { gte: startOfDay },
      result: { in: ['GRANTED', 'OFFLINE_GRANTED'] },
    },
  })
  if (occupancy >= gym.capacity) {
    throw new DomainError('DENIED_CAPACITY', 'Aforo completo. Intenta en unos minutos', 409)
  }
}
