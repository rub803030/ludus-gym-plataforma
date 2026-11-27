import { prisma } from './database/prisma.js'
import { DomainError } from './errors/domain-error.js'

/**
 * `Member.gymId` es un campo legado: nunca autoriza por sí solo.
 * La fuente de verdad es `GymMembership` junto con el estado del gimnasio.
 */
export async function assertActiveGymMembership(memberId: string, gymId: string): Promise<void> {
  const link = await prisma.gymMembership.findFirst({
    where: { memberId, gymId, isActive: true, status: 'ACTIVE', deletedAt: null },
    select: { gym: { select: { status: true, deletedAt: true } } },
  })
  if (!link) {
    throw new DomainError('NO_GYM', 'El socio no tiene una afiliación activa en este gimnasio', 403)
  }
  if (link.gym.status !== 'ACTIVE' || link.gym.deletedAt) {
    throw new DomainError('GYM_NOT_ACTIVE', 'El gimnasio no está activo', 403)
  }
}

/** Una membresía sólo aplica en el gimnasio dueño del plan contratado. */
export function activeMembershipWhere(gymId: string) {
  return { status: 'ACTIVE' as const, plan: { gymId } }
}
