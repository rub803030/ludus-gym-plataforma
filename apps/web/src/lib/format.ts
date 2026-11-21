import type { Role } from '@/types'

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const decimalFormatter = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatCurrency(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0)
}

export function formatNumber(value: number): string {
  return decimalFormatter.format(Number.isFinite(value) ? value : 0)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function relativeDayLabel(days: number): string {
  if (days === 0) return 'hoy'
  return days === 1 ? '1 día' : `${days} días`
}

const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Propietario',
  MANAGER: 'Encargado',
  STAFF: 'Equipo',
  MEMBER: 'Socio',
}

/** Etiqueta visible de un perfil; el código interno se mantiene sin cambios. */
export function roleLabel(role: Role | null | undefined): string {
  return role ? ROLE_LABELS[role] : 'Perfil no verificado'
}
