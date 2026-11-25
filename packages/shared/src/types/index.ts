import type { Role } from '../constants/roles.js'

export interface Principal {
  id: string
  role: Role
  platform: 'web' | 'mobile'
  jti: string
  /** Gimnasio activo de la sesión; cadena vacía cuando el socio aún no tiene uno. */
  gymId: string
  activeGymId: string | null
}