/** View models used by the web console. They are transport-agnostic on purpose:
 *  the API is normalized at the edge (see lib/normalize.ts) so a rename in a
 *  backend response never leaks into a feature component. */

export type Role = 'OWNER' | 'MANAGER' | 'STAFF' | 'MEMBER'
export type MemberStatus = 'active' | 'pending' | 'expired' | 'overdue' | 'inactive'
export type PaymentMethod = 'cash' | 'card' | 'transfer'
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed'
export type QrResultStatus = 'idle' | 'valid' | 'invalid' | 'expired' | 'duplicate'

export interface ApiError {
  status: number
  code: string
  message: string
  details?: Record<string, unknown>
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'message' in value &&
    typeof (value as { status?: unknown }).status === 'number' &&
    typeof (value as { message?: unknown }).message === 'string'
  )
}

export interface Principal {
  id: string
  role: Role
  platform: 'web' | 'mobile'
  jti: string
  gymId: string
  activeGymId?: string | null
  name?: string
  email?: string
}

export interface Session {
  principal: Principal
  csrfToken: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface MembershipView {
  id: string
  planName: string
  status: MemberStatus
  startDate: string
  endDate: string
  remainingDays: number
}

export interface MemberView {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  document: string
  phone: string
  status: MemberStatus
  membership: MembershipView | null
  medicalNotes: string | null
  joinedAt: string
}

export interface PaymentView {
  id: string
  memberId: string
  memberName: string
  planName: string
  amount: number
  currency: string
  method: PaymentMethod
  status: PaymentStatus
  createdAt: string
  reference: string
  receiptCode: string
}

export interface PlanFlag {
  key: 'gym_access' | 'classes' | 'nutrition' | 'guest_pass'
  label: string
}

export const PLAN_FLAGS: readonly PlanFlag[] = [
  { key: 'gym_access', label: 'Acceso a piso' },
  { key: 'classes', label: 'Clases grupales' },
  { key: 'nutrition', label: 'Plan nutricional' },
  { key: 'guest_pass', label: 'Pase de invitado' },
]

export interface PlanView {
  id: string
  name: string
  durationDays: number
  price: number
  currency: string
  flags: Array<PlanFlag['key']>
  active: boolean
  description: string
  createdAt: string
}

export type GymStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED'

export interface GymRegisterInput {
  gymName: string
  slug?: string
  ownerName: string
  email: string
  password: string
  timezone: string
  capacity: number
  currency: 'MXN'
  address?: string
  phone?: string
  openingHours?: string
}

export interface GymProfileInput {
  name?: string
  address?: string | null
  phone?: string | null
  openingHours?: string | null
  logoUrl?: string | null
  timezone?: string
  capacity?: number
  currency?: 'MXN'
}

export interface GymProfile {
  id: string
  name: string
  slug: string
  status: GymStatus
  publicCode: string
  enrollmentQrToken: string
  timezone: string
  capacity: number
  currency: string
  address: string | null
  phone: string | null
  openingHours: string | null
  logoUrl: string | null
}

export interface GymRegistration {
  gym: { id: string; name: string; slug: string; status: GymStatus }
  owner: { email: string; fullName: string }
  verification: { email: string; expiresAt: string; devToken?: string; devLink?: string }
}

export interface GymVerification {
  ok: boolean
  gym: { id: string; name: string; status: GymStatus; publicCode: string; enrollmentQrToken: string }
}

export interface StaffUser {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  lastActiveAt: string | null
}

export interface RoutineExercise {
  id: string
  name: string
  sets: number
  reps: number
  weightKg: number
}

export interface RoutineView {
  id: string
  memberId: string
  memberName: string
  name: string
  exercises: RoutineExercise[]
  createdAt: string
}

export interface NutritionPlanView {
  id: string
  memberId: string
  name: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface OccupancyView {
  current: number
  capacity: number
  percent: number
  updatedAt: string
  zones: Array<{ name: string; current: number; capacity: number }>
}

export interface AccessEvent {
  id: string
  memberName: string
  at: string
  result: 'granted' | 'denied' | 'duplicate'
  detail: string
}

export interface ReportSummaryView {
  todayRevenue: number
  yesterdayRevenue: number
  activeMembers: number
  pendingExpirations: number
  transactionsToday: number
  averageTicket: number
  revenueByDay: Array<{ label: string; amount: number }>
}

export interface AuditLogView {
  id: string
  actor: string
  action: string
  target: string
  at: string
  severity: 'info' | 'warning' | 'critical'
}

export interface CashSessionView {
  id: string
  openedAt: string
  closedAt: string | null
  openedBy: string
  startingAmount: number
  expectedAmount: number
  status: 'open' | 'closed'
}
