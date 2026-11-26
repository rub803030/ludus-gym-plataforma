/** View models used by the web console. They are transport-agnostic on purpose:
 *  the API is normalized at the edge (see lib/normalize.ts) so a rename in a
 *  backend response never leaks into a feature component. */

export type Role = 'ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF' | 'MEMBER'
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
  contactEmail: string
  phone: string
  address: string
  city: string
  state: string
  postalCode: string
  legalRepresentative: string
  rfc: string
  website?: string
  socialMedia?: string
  description?: string
  branchCount?: number
  timezone: string
  capacity: number
  currency: 'MXN'
  openingHours?: string
}

export interface GymProfileInput {
  name?: string
  address?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  contactEmail?: string | null
  phone?: string | null
  legalRepresentative?: string | null
  rfc?: string | null
  website?: string | null
  socialMedia?: string | null
  description?: string | null
  branchCount?: number
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
  city: string | null
  state: string | null
  postalCode: string | null
  contactEmail: string | null
  phone: string | null
  legalRepresentative: string | null
  rfc: string | null
  website: string | null
  socialMedia: string | null
  description: string | null
  branchCount: number
  openingHours: string | null
  logoUrl: string | null
  approvedAt: string | null
}

export interface VerificationIssue {
  email: string
  expiresAt: string
  devToken?: string
  devLink?: string
}

export interface GymRegistration {
  gym: GymProfile
  owner: { email: string; fullName: string }
  verification: VerificationIssue
  approval: VerificationIssue
}

export interface GymVerification {
  ok: boolean
  message: string
  gym: { id: string; name: string; status: GymStatus; publicCode: string; enrollmentQrToken: string }
}

export interface PendingGym {
  id: string
  name: string
  slug: string
  status: GymStatus
  address: string
  city: string
  state: string
  postalCode: string
  contactEmail: string
  phone: string
  legalRepresentative: string
  rfc: string
  website: string
  socialMedia: string
  description: string
  branchCount: number
  openingHours: string
  createdAt: string
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
