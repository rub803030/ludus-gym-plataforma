import type { Role } from '../constants/roles.js'

export interface Principal {
  id: string
  role: Role
  platform: 'web' | 'mobile'
  jti: string
  gymId: string
}