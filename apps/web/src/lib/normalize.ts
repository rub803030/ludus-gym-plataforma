import type {
  AccessEvent,
  AuditLogView,
  CashSessionView,
  GymProfile,
  GymRegistration,
  GymStatus,
  GymVerification,
  MemberStatus,
  MemberView,
  NutritionPlanView,
  OccupancyView,
  Paginated,
  PaymentMethod,
  PaymentStatus,
  PaymentView,
  PlanView,
  Principal,
  ReportSummaryView,
  Role,
  RoutineView,
  StaffUser,
} from '@/types'

const ROLES: readonly string[] = ['OWNER', 'MANAGER', 'STAFF', 'MEMBER']
const GYM_STATUSES: readonly GymStatus[] = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED']
const PLAN_KEYS: ReadonlyArray<'gym_access' | 'classes' | 'nutrition' | 'guest_pass'> = [
  'gym_access',
  'classes',
  'nutrition',
  'guest_pass',
]

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (['true', 'activo', 'active', '1', 'si', 'sí'].includes(value.toLowerCase())) return true
    if (['false', 'inactivo', 'inactive', '0', 'no'].includes(value.toLowerCase())) return false
  }
  return fallback
}

export function pick(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

export function coalesce(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function normalizeRole(value: unknown, fallback: Role = 'STAFF'): Role {
  const role = asString(value).toUpperCase()
  return ROLES.includes(role) ? (role as Role) : fallback
}

function normalizeGymStatus(value: unknown, fallback: GymStatus = 'PENDING_VERIFICATION'): GymStatus {
  const status = asString(value).toUpperCase() as GymStatus
  return GYM_STATUSES.includes(status) ? status : fallback
}

function normalizeStatus(value: unknown, fallback: MemberStatus = 'inactive'): MemberStatus {
  const raw = asString(value).toLowerCase().replace(/[_-]/g, ' ')
  if (raw.includes('active') || raw.includes('activo') || raw.includes('vigente')) return 'active'
  if (raw.includes('pending') || raw.includes('pendiente')) return 'pending'
  if (raw.includes('expired') || raw.includes('vencid')) return 'expired'
  if (raw.includes('overdue') || raw.includes('moros') || raw.includes('atrasad')) return 'overdue'
  return fallback
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const raw = asString(value).toLowerCase()
  if (raw.includes('refund')) return 'refunded'
  if (raw.includes('fail') || raw.includes('rechaz')) return 'failed'
  if (raw.includes('pending') || raw.includes('pendient')) return 'pending'
  return 'paid'
}

function normalizeMethod(value: unknown): PaymentMethod {
  const raw = asString(value).toLowerCase()
  if (raw === 'card' || raw === 'tarjeta') return 'card'
  if (raw === 'transfer' || raw === 'transferencia' || raw === 'spei') return 'transfer'
  return 'cash'
}

function daysUntil(value: string): number {
  if (!value) return 0
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function normalizePrincipal(raw: unknown): Principal | null {
  const outer = asRecord(raw)
  const inner = asRecord(coalesce(pick(outer, 'principal'), pick(outer, 'user'), pick(outer, 'data')))
  const id = asString(coalesce(pick(outer, 'id'), pick(inner, 'id'), pick(inner, 'userId')))
  const role = normalizeRole(coalesce(pick(outer, 'role'), pick(inner, 'role')), 'MEMBER')
  if (!id || role === 'MEMBER') return null
  const platformRaw = asString(coalesce(pick(outer, 'platform'), pick(inner, 'platform')))
  const principal: Principal = {
    id,
    role,
    platform: platformRaw === 'mobile' ? 'mobile' : 'web',
    jti: asString(coalesce(pick(outer, 'jti'), pick(inner, 'jti')), id),
    gymId: asString(coalesce(pick(outer, 'gymId'), pick(inner, 'gymId')), 'principal'),
    activeGymId: asString(coalesce(pick(outer, 'activeGymId'), pick(inner, 'activeGymId'))) || null,
  }
  const name = asString(coalesce(pick(outer, 'name'), pick(inner, 'name'), pick(inner, 'fullName')))
  const email = asString(coalesce(pick(outer, 'email'), pick(inner, 'email')))
  if (name) principal.name = name
  if (email) principal.email = email
  return principal
}

export function normalizeMember(raw: unknown): MemberView {
  const r = asRecord(raw)
  const membershipRaw = coalesce(pick(r, 'membership'), pick(r, 'membershipDetails'), pick(r, 'plan'))
  const m = asRecord(membershipRaw)
  const firstName = asString(coalesce(pick(r, 'firstName'), pick(r, 'nombre')), 'Socio')
  const lastName = asString(coalesce(pick(r, 'lastName'), pick(r, 'apellido')))
  const fullName = asString(
    coalesce(pick(r, 'fullName'), pick(r, 'name'), firstName ? `${firstName} ${lastName}`.trim() : undefined),
    'Socio'
  )
  const medicalRaw = coalesce(
    pick(r, 'medicalNotes'),
    pick(r, 'medical'),
    pick(r, 'notes'),
    pick(asRecord(pick(r, 'medicalDetails')), 'notes')
  )
  const endDate = asString(coalesce(pick(m, 'endDate'), pick(m, 'expiresAt'), pick(r, 'expiresAt')))
  const status = normalizeStatus(coalesce(pick(r, 'status'), pick(m, 'status'), pick(r, 'membershipStatus')))
  const membership = membershipRaw || endDate
    ? {
        id: asString(pick(m, 'id'), 'sin-id'),
        planName: asString(coalesce(pick(m, 'planName'), pick(m, 'name'), pick(r, 'planName')), 'Plan sin nombre'),
        status,
        startDate: asString(coalesce(pick(m, 'startDate'), pick(m, 'createdAt'))),
        endDate,
        remainingDays: asNumber(
          coalesce(pick(m, 'remainingDays'), pick(m, 'daysRemaining')),
          endDate ? daysUntil(endDate) : 0
        ),
      }
    : null

  return {
    id: asString(pick(r, 'id'), 'sin-id'),
    firstName,
    lastName,
    fullName,
    email: asString(pick(r, 'email')),
    document: asString(coalesce(pick(r, 'document'), pick(r, 'documento'))),
    phone: asString(coalesce(pick(r, 'phone'), pick(r, 'telefono'))),
    status,
    membership,
    medicalNotes: medicalRaw === undefined ? null : asString(medicalRaw),
    joinedAt: asString(coalesce(pick(r, 'joinedAt'), pick(r, 'createdAt'))),
  }
}

export function normalizePayment(raw: unknown): PaymentView {
  const r = asRecord(raw)
  const member = asRecord(coalesce(pick(r, 'member'), pick(r, 'socio')))
  const id = asString(coalesce(pick(r, 'id'), pick(r, 'paymentId')), 'sin-id')
  return {
    id,
    memberId: asString(coalesce(pick(r, 'memberId'), pick(member, 'id'))),
    memberName: asString(coalesce(pick(r, 'memberName'), pick(member, 'fullName'), pick(member, 'name')), 'Socio'),
    planName: asString(coalesce(pick(r, 'planName'), pick(asRecord(pick(r, 'plan')), 'name')), 'Cobro'),
    amount: asNumber(coalesce(pick(r, 'amount'), pick(r, 'total'))),
    currency: asString(pick(r, 'currency'), 'MXN'),
    method: normalizeMethod(coalesce(pick(r, 'method'), pick(r, 'paymentMethod'))),
    status: normalizePaymentStatus(pick(r, 'status')),
    createdAt: asString(coalesce(pick(r, 'createdAt'), pick(r, 'date'))),
    reference: asString(coalesce(pick(r, 'reference'), pick(r, 'folio')), id.slice(0, 8).toUpperCase()),
    receiptCode: asString(coalesce(pick(r, 'receiptCode'), pick(r, 'qrCode'), pick(r, 'code')), `LUD-${id.slice(0, 8).toUpperCase()}`),
  }
}

export function normalizePlan(raw: unknown): PlanView {
  const r = asRecord(raw)
  const flagsRaw = asArray(coalesce(pick(r, 'flags'), pick(r, 'features'), pick(r, 'benefits')))
  const flagKeys = flagsRaw
    .map((flag) => (typeof flag === 'string' ? flag : asString(pick(asRecord(flag), 'key', 'name'))))
    .filter((flag): flag is 'gym_access' | 'classes' | 'nutrition' | 'guest_pass' =>
      (PLAN_KEYS as readonly string[]).includes(flag)
    )
  const includesClasses = asBoolean(coalesce(pick(r, 'includesClasses'), flagKeys.includes('classes')))
  const includesNutrition = asBoolean(coalesce(pick(r, 'includesNutrition'), flagKeys.includes('nutrition')))
  const flags = PLAN_KEYS.filter(
    (key) =>
      key === 'gym_access' ||
      flagKeys.includes(key) ||
      (key === 'classes' && includesClasses) ||
      (key === 'nutrition' && includesNutrition)
  )
  return {
    id: asString(pick(r, 'id'), 'sin-id'),
    name: asString(coalesce(pick(r, 'name'), pick(r, 'planName')), 'Plan'),
    durationDays: asNumber(coalesce(pick(r, 'durationDays'), pick(r, 'duration'), pick(r, 'durationInDays')), 30),
    price: asNumber(coalesce(pick(r, 'price'), pick(r, 'amount')), 0),
    currency: asString(coalesce(pick(r, 'currency'), 'MXN')),
    flags,
    active: asBoolean(coalesce(pick(r, 'active'), pick(r, 'isActive'), pick(r, 'enabled')), true),
    description: asString(pick(r, 'description')),
    createdAt: asString(coalesce(pick(r, 'createdAt'), pick(r, 'created_at'))),
  }
}

export function normalizeGym(raw: unknown): GymProfile {
  const r = asRecord(raw)
  return {
    id: asString(pick(r, 'id'), 'sin-id'),
    name: asString(coalesce(pick(r, 'name'), pick(r, 'gymName')), 'Gimnasio'),
    slug: asString(pick(r, 'slug')),
    status: normalizeGymStatus(pick(r, 'status')),
    publicCode: asString(pick(r, 'publicCode')),
    enrollmentQrToken: asString(pick(r, 'enrollmentQrToken')),
    timezone: asString(pick(r, 'timezone'), 'America/Mexico_City'),
    capacity: asNumber(pick(r, 'capacity'), 20),
    currency: asString(pick(r, 'currency'), 'MXN'),
    address: asString(pick(r, 'address')) || null,
    phone: asString(pick(r, 'phone')) || null,
    openingHours: asString(coalesce(pick(r, 'openingHours'), pick(r, 'opening_hours'))) || null,
    logoUrl: asString(coalesce(pick(r, 'logoUrl'), pick(r, 'logo_url'))) || null,
  }
}

export function normalizeGymRegistration(raw: unknown): GymRegistration {
  const r = asRecord(raw)
  const gym = asRecord(pick(r, 'gym'))
  const owner = asRecord(pick(r, 'owner'))
  const verification = asRecord(pick(r, 'verification'))
  const devToken = asString(pick(verification, 'devToken'))
  const devLink = asString(pick(verification, 'devLink'))
  return {
    gym: {
      id: asString(pick(gym, 'id'), 'sin-id'),
      name: asString(pick(gym, 'name'), 'Gimnasio'),
      slug: asString(pick(gym, 'slug')),
      status: normalizeGymStatus(pick(gym, 'status')),
    },
    owner: {
      email: asString(pick(owner, 'email'), asString(pick(verification, 'email'))),
      fullName: asString(pick(owner, 'fullName'), asString(pick(owner, 'ownerName'))),
    },
    verification: {
      email: asString(pick(verification, 'email'), asString(pick(owner, 'email'))),
      expiresAt: asString(pick(verification, 'expiresAt')),
      ...(devToken ? { devToken } : {}),
      ...(devLink ? { devLink } : {}),
    },
  }
}

export function normalizeGymVerification(raw: unknown): GymVerification {
  const r = asRecord(raw)
  const gym = asRecord(pick(r, 'gym'))
  return {
    ok: asBoolean(coalesce(pick(r, 'ok'), true)),
    gym: {
      id: asString(pick(gym, 'id'), 'sin-id'),
      name: asString(pick(gym, 'name'), 'Gimnasio'),
      status: normalizeGymStatus(pick(gym, 'status')),
      publicCode: asString(pick(gym, 'publicCode')),
      enrollmentQrToken: asString(pick(gym, 'enrollmentQrToken')),
    },
  }
}

export function normalizeStaff(raw: unknown): StaffUser {
  const r = asRecord(raw)
  const user = asRecord(coalesce(pick(r, 'user'), pick(r, 'staff')))
  return {
    id: asString(coalesce(pick(r, 'id'), pick(user, 'id')), 'sin-id'),
    name: asString(coalesce(pick(r, 'name'), pick(r, 'fullName'), pick(user, 'name')), 'Sin nombre'),
    email: asString(coalesce(pick(r, 'email'), pick(user, 'email'))),
    role: normalizeRole(coalesce(pick(r, 'role'), pick(user, 'role'))),
    active: asBoolean(coalesce(pick(r, 'active'), pick(r, 'enabled'), pick(user, 'active')), true),
    lastActiveAt: asString(coalesce(pick(r, 'lastActiveAt'), pick(r, 'lastLoginAt'), pick(user, 'lastActiveAt'))) || null,
  }
}

export function normalizeRoutine(raw: unknown): RoutineView {
  const r = asRecord(raw)
  const member = asRecord(coalesce(pick(r, 'member'), pick(r, 'socio')))
  const exercises = asArray(coalesce(pick(r, 'exercises'), pick(r, 'items'))).map((item, index) => {
    const e = asRecord(item)
    return {
      id: asString(pick(e, 'id'), `ejercicio-${index}`),
      name: asString(coalesce(pick(e, 'name'), pick(e, 'exercise')), 'Ejercicio'),
      sets: asNumber(coalesce(pick(e, 'sets'), pick(e, 'series')), 3),
      reps: asNumber(coalesce(pick(e, 'reps'), pick(e, 'repeticiones')), 10),
      weightKg: asNumber(coalesce(pick(e, 'weightKg'), pick(e, 'weight')), 0),
    }
  })
  return {
    id: asString(pick(r, 'id'), 'sin-id'),
    memberId: asString(coalesce(pick(r, 'memberId'), pick(member, 'id'))),
    memberName: asString(coalesce(pick(r, 'memberName'), pick(member, 'fullName'), pick(member, 'name')), 'Socio'),
    name: asString(pick(r, 'name'), 'Rutina'),
    exercises,
    createdAt: asString(coalesce(pick(r, 'createdAt'), pick(r, 'date'))),
  }
}

export function normalizeNutrition(raw: unknown): NutritionPlanView {
  const r = asRecord(raw)
  const macros = asRecord(coalesce(pick(r, 'macros'), pick(r, 'targets')))
  return {
    id: asString(pick(r, 'id'), 'sin-id'),
    memberId: asString(pick(r, 'memberId')),
    name: asString(pick(r, 'name'), 'Plan nutricional'),
    calories: asNumber(coalesce(pick(r, 'calories'), pick(macros, 'calories')), 0),
    proteinG: asNumber(coalesce(pick(r, 'proteinG'), pick(macros, 'proteinG'), pick(macros, 'protein')), 0),
    carbsG: asNumber(coalesce(pick(r, 'carbsG'), pick(macros, 'carbsG'), pick(macros, 'carbs')), 0),
    fatG: asNumber(coalesce(pick(r, 'fatG'), pick(macros, 'fatG'), pick(macros, 'fat')), 0),
  }
}

export function normalizeOccupancy(raw: unknown): OccupancyView {
  const r = asRecord(raw)
  const data = asRecord(coalesce(pick(r, 'occupancy'), pick(r, 'data')))
  const current = asNumber(coalesce(pick(r, 'current'), pick(data, 'current'), pick(r, 'count'), pick(data, 'count')))
  const capacity = asNumber(coalesce(pick(r, 'capacity'), pick(data, 'capacity'), pick(r, 'limit')), 1)
  const zones = asArray(coalesce(pick(r, 'zones'), pick(data, 'zones'))).map((zone, index) => {
    const z = asRecord(zone)
    return {
      name: asString(coalesce(pick(z, 'name'), pick(z, 'label')), `Zona ${index + 1}`),
      current: asNumber(coalesce(pick(z, 'current'), pick(z, 'count'))),
      capacity: asNumber(coalesce(pick(z, 'capacity')), 1),
    }
  })
  return {
    current,
    capacity: capacity || 1,
    percent: Math.min(100, Math.round((current / (capacity || 1)) * 100)),
    updatedAt: asString(coalesce(pick(r, 'updatedAt'), pick(data, 'updatedAt'))),
    zones,
  }
}

export function normalizeAccessEvent(raw: unknown): AccessEvent {
  const r = asRecord(raw)
  const member = asRecord(coalesce(pick(r, 'member'), pick(r, 'socio')))
  const resultRaw = asString(coalesce(pick(r, 'result'), pick(r, 'status'))).toLowerCase()
  const result: AccessEvent['result'] = resultRaw.includes('denied') || resultRaw.includes('rechaz')
    ? 'denied'
    : resultRaw.includes('duplicate') || resultRaw.includes('duplicad')
      ? 'duplicate'
      : 'granted'
  return {
    id: asString(pick(r, 'id'), `evento-${Date.now()}`),
    memberName: asString(coalesce(pick(r, 'memberName'), pick(member, 'fullName'), pick(member, 'name')), 'Socio'),
    at: asString(coalesce(pick(r, 'at'), pick(r, 'createdAt'), pick(r, 'timestamp'))),
    result,
    detail: asString(coalesce(pick(r, 'detail'), pick(r, 'message')), result === 'granted' ? 'Acceso concedido' : 'Acceso denegado'),
  }
}

export function normalizeSummary(raw: unknown): ReportSummaryView {
  const r = asRecord(raw)
  const data = asRecord(coalesce(pick(r, 'data'), pick(r, 'summary'), pick(r, 'reports')))
  const byDayRaw = asArray(coalesce(pick(data, 'revenueByDay'), pick(r, 'revenueByDay'), pick(data, 'dailyRevenue')))
  return {
    todayRevenue: asNumber(coalesce(pick(data, 'todayRevenue'), pick(r, 'todayRevenue'), pick(data, 'revenue'))),
    yesterdayRevenue: asNumber(coalesce(pick(data, 'yesterdayRevenue'), pick(r, 'yesterdayRevenue'))),
    activeMembers: asNumber(coalesce(pick(data, 'activeMembers'), pick(r, 'activeMembers'))),
    pendingExpirations: asNumber(coalesce(pick(data, 'pendingExpirations'), pick(r, 'pendingExpirations'))),
    transactionsToday: asNumber(coalesce(pick(data, 'transactionsToday'), pick(r, 'transactionsToday'))),
    averageTicket: asNumber(coalesce(pick(data, 'averageTicket'), pick(r, 'averageTicket'))),
    revenueByDay: byDayRaw.map((item, index) => {
      const d = asRecord(item)
      return {
        label: asString(coalesce(pick(d, 'label'), pick(d, 'date'), pick(d, 'day')), `Día ${index + 1}`),
        amount: asNumber(coalesce(pick(d, 'amount'), pick(d, 'revenue'), pick(d, 'total'))),
      }
    }),
  }
}

export function normalizeAudit(raw: unknown): AuditLogView {
  const r = asRecord(raw)
  const severityRaw = asString(coalesce(pick(r, 'severity'), pick(r, 'level'))).toLowerCase()
  const severity: AuditLogView['severity'] = severityRaw.includes('critical') || severityRaw.includes('crític')
    ? 'critical'
    : severityRaw.includes('warn')
      ? 'warning'
      : 'info'
  return {
    id: asString(pick(r, 'id'), 'sin-id'),
    actor: asString(coalesce(pick(r, 'actor'), pick(r, 'actorName'), pick(r, 'user')), 'Sistema'),
    action: asString(coalesce(pick(r, 'action'), pick(r, 'event')), 'Acción registrada'),
    target: asString(coalesce(pick(r, 'target'), pick(r, 'resource'), pick(r, 'entity'))),
    at: asString(coalesce(pick(r, 'at'), pick(r, 'createdAt'), pick(r, 'timestamp'))),
    severity,
  }
}

export function normalizeCashSession(raw: unknown): CashSessionView {
  const r = asRecord(raw)
  return {
    id: asString(pick(r, 'id'), 'sin-id'),
    openedAt: asString(coalesce(pick(r, 'openedAt'), pick(r, 'createdAt'))),
    closedAt: asString(pick(r, 'closedAt')) || null,
    openedBy: asString(coalesce(pick(r, 'openedBy'), pick(r, 'openedByName')), 'Operador'),
    startingAmount: asNumber(coalesce(pick(r, 'startingAmount'), pick(r, 'openingAmount'))),
    expectedAmount: asNumber(coalesce(pick(r, 'expectedAmount'), pick(r, 'total'))),
    status: asString(pick(r, 'status')).toLowerCase().includes('closed') ? 'closed' : 'open',
  }
}

export function normalizePaginated<T>(
  raw: unknown,
  normalize: (value: unknown) => T,
  extraKeys: string[] = []
): Paginated<T> {
  const r = asRecord(raw)
  const listRaw = Array.isArray(raw)
    ? raw
    : asArray(
        coalesce(
          ...['items', 'data', 'results', 'rows', ...extraKeys].map((key) => pick(r, key))
        )
      )
  return {
    items: listRaw.map(normalize),
    total: asNumber(coalesce(pick(r, 'total'), pick(r, 'count')), listRaw.length),
    page: asNumber(coalesce(pick(r, 'page'), pick(r, 'currentPage')), 1),
    pageSize: asNumber(coalesce(pick(r, 'pageSize'), pick(r, 'perPage')), Math.max(listRaw.length, 1)),
  }
}
