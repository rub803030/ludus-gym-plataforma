export interface MemberAccessState {
  memberStatus: string
  affiliation: {
    status: string
    isActive: boolean
    deletedAt: Date | null
  } | null
  memberships: Array<{
    status: string
    startDate: Date | null
    endDate: Date | null
    plan: { gymId: string }
  }>
}

export interface MemberAccessDenial {
  code: 'USER_INACTIVE' | 'NO_GYM' | 'GYM_MEMBERSHIP_SUSPENDED' | 'NO_MEMBERSHIP' | 'MEMBERSHIP_NOT_STARTED' | 'MEMBERSHIP_EXPIRED'
  message: string
}

export function memberAccessDenial(
  state: MemberAccessState,
  gymId: string,
  now = new Date(),
): MemberAccessDenial | null {
  if (state.memberStatus === 'SUSPENDED') {
    return { code: 'USER_INACTIVE', message: 'La cuenta del socio está suspendida' }
  }

  const affiliation = state.affiliation
  if (affiliation?.status === 'SUSPENDED') {
    return { code: 'GYM_MEMBERSHIP_SUSPENDED', message: 'La afiliación a este gimnasio está suspendida' }
  }
  if (!affiliation || !affiliation.isActive || affiliation.deletedAt || affiliation.status !== 'ACTIVE') {
    return { code: 'NO_GYM', message: 'El socio no tiene una afiliación activa en este gimnasio' }
  }

  const today = new Date(now.getTime())
  today.setUTCHours(0, 0, 0, 0)
  const gymMemberships = state.memberships.filter(
    (membership) => membership.plan.gymId === gymId && membership.status === 'ACTIVE',
  )
  const current = gymMemberships.find(
    (membership) =>
      membership.startDate !== null &&
      membership.endDate !== null &&
      membership.startDate.getTime() <= today.getTime() &&
      membership.endDate.getTime() >= today.getTime(),
  )
  if (current) return null

  if (gymMemberships.some((membership) => membership.startDate && membership.startDate.getTime() > today.getTime())) {
    return { code: 'MEMBERSHIP_NOT_STARTED', message: 'La membresía todavía no comienza' }
  }
  if (gymMemberships.some((membership) => membership.endDate && membership.endDate.getTime() < today.getTime())) {
    return { code: 'MEMBERSHIP_EXPIRED', message: 'La membresía venció. Renueva antes de dar acceso' }
  }
  return { code: 'NO_MEMBERSHIP', message: 'No hay una membresía vigente para este gimnasio' }
}
