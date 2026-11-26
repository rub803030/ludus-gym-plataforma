import type { Role } from './roles.js'

export const PERMISSIONS = [
  'members:read', 'members:write', 'members:medical:read',
  'payments:charge', 'payments:refund', 'payments:audit',
  'cash:shift:open', 'cash:shift:close',
  'staff:manage', 'plans:manage', 'reports:financial',
  'routines:assign', 'nutrition:assign', 'classes:manage',
  'access:checkin', 'audit:read',
] as const

/** Autorización global de gimnasios: solo el rol ADMIN puede aprobar altas. */
export const ADMIN_PERMISSIONS = [...PERMISSIONS, 'gyms:approve'] as const

export type Permission = (typeof ADMIN_PERMISSIONS)[number]

const MATRIX: Record<Role, readonly Permission[]> = {
  ADMIN: ADMIN_PERMISSIONS,
  OWNER: PERMISSIONS,
  MANAGER: [
    'members:read', 'members:write', 'members:medical:read',
    'payments:charge', 'cash:shift:open', 'cash:shift:close',
    'routines:assign', 'nutrition:assign', 'classes:manage',
    'access:checkin', 'audit:read',
  ],
  STAFF: [
    'members:read', 'payments:charge', 'cash:shift:open',
    'cash:shift:close', 'access:checkin',
  ],
  MEMBER: [],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission)
}
