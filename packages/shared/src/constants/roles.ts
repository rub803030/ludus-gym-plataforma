export const PLATFORM_ACCESS = {
  web: ['ADMIN', 'OWNER', 'MANAGER', 'STAFF'],
  mobile: ['MEMBER'],
} as const

export type Role = 'ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF' | 'MEMBER'

export const ROLE_RANK: Record<Role, number> = {
  ADMIN: 4,
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
