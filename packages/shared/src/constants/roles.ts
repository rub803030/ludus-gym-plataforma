export const PLATFORM_ACCESS = {
  web: ['OWNER', 'MANAGER', 'STAFF'],
  mobile: ['MEMBER'],
} as const

export type Role = 'OWNER' | 'MANAGER' | 'STAFF' | 'MEMBER'

export const ROLE_RANK: Record<Role, number> = {
  OWNER: 3,
  MANAGER: 2,
  STAFF: 1,
  MEMBER: 0,
}

export function canAccessWeb(role: Role): boolean {
  return (PLATFORM_ACCESS.web as readonly Role[]).includes(role)
}

export function canAccessMobile(role: Role): boolean {
  return (PLATFORM_ACCESS.mobile as readonly Role[]).includes(role)
}

export function outranks(a: Role, b: Role): boolean {
  return ROLE_RANK[a] > ROLE_RANK[b]
}