export function gymMembershipLinkFilter(gymId: string) {
  return {
    gymId,
    deletedAt: null,
  }
}

export function activeGymMembershipFilter(gymId: string) {
  return {
    ...gymMembershipLinkFilter(gymId),
    isActive: true,
    status: 'ACTIVE',
  }
}

export function memberGymScope(gymId: string) {
  return {
    gymMemberships: {
      some: gymMembershipLinkFilter(gymId),
    },
  }
}

export function activeMemberGymScope(gymId: string) {
  return {
    gymMemberships: {
      some: activeGymMembershipFilter(gymId),
    },
  }
}
