import { asBoolean, asNumber, asRecord, asString, coalesce, normalizeAccessEvent, normalizeCashSession, normalizeMember, normalizeNutrition, normalizeOccupancy, normalizePaginated, normalizePayment, normalizePlan, normalizePrincipal, normalizeRoutine, normalizeStaff, normalizeSummary, normalizeAudit, pick } from '@/lib/normalize'
import type {
  AccessEvent,
  ApiError,
  AuditLogView,
  CashSessionView,
  NutritionPlanView,
  OccupancyView,
  Paginated,
  PaymentMethod,
  PaymentView,
  PlanView,
  Principal,
  QrResultStatus,
  ReportSummaryView,
  RoutineView,
  Session,
  StaffUser,
  MemberView,
} from '@/types'

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
export const SESSION_EXPIRED_EVENT = 'ludus:session-expired'

/* ------------------------------------------------------------------ *
 * Session store (module level, observable by React via useSyncExternalStore)
 * ------------------------------------------------------------------ */

let currentSession: Session | null = null
const sessionListeners = new Set<() => void>()

export function getSession(): Session | null {
  return currentSession
}

export function setSession(next: Session | null): void {
  currentSession = next
  if (typeof window !== 'undefined') {
    try {
      if (next) {
        window.sessionStorage.setItem('ludus_principal', JSON.stringify(next.principal))
      } else {
        window.sessionStorage.removeItem('ludus_principal')
      }
    } catch {
      /* storage may be blocked; the in-memory store still works */
    }
  }
  sessionListeners.forEach((listener) => listener())
}

export function clearSession(): void {
  setSession(null)
}

export function subscribeSession(listener: () => void): () => void {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

export function hydrateSession(): Session | null {
  if (typeof window === 'undefined') return currentSession
  if (currentSession) return currentSession
  try {
    const stored = window.sessionStorage.getItem('ludus_principal')
    if (!stored) return null
    const principal = normalizePrincipal(JSON.parse(stored) as unknown)
    if (!principal) return null
    currentSession = { principal, csrfToken: readCsrfToken() }
    sessionListeners.forEach((listener) => listener())
    return currentSession
  } catch {
    return null
  }
}

export function readCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/(?:^|;\s*)ludus_csrf=([^;]+)/)
  if (!match?.[1]) return ''
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function createIdempotencyKey(): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `ludus_${uuid}`
}

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

function toApiError(status: number, body: unknown): ApiError {
  const r = asRecord(body)
  const code = asString(coalesce(pick(r, 'code'), pick(r, 'errorCode'), pick(r, 'error')), `HTTP_${status}`)
  const rawMessage = asString(coalesce(pick(r, 'message'), pick(r, 'detail'), pick(r, 'msg'), pick(r, 'error')))
  const daysRaw = asNumber(
    coalesce(pick(r, 'days'), pick(r, 'daysOverdue'), pick(r, 'expiredDays'), pick(r, 'daysPastDue')),
    Number.parseInt(rawMessage.match(/(\d+)\s*(?:día|dia|day)/i)?.[1] ?? '0', 10)
  )
  let message: string

  if (
    code === 'MEMBERSHIP_EXPIRED' ||
    code === 'MEMBER_EXPIRED' ||
    /vencid|expired/i.test(`${code} ${rawMessage}`)
  ) {
    const days = Math.max(1, daysRaw)
    message = `La membresía venció hace ${days} ${days === 1 ? 'día' : 'días'}; puedes renovarla aquí mismo antes de dar acceso`
  } else if (code === 'MEMBER_ROLE' || code === 'PLATFORM_NOT_ALLOWED' || /solo.*app|mobile.*only/i.test(rawMessage)) {
    message = 'Esta cuenta es de socio y solo puede ingresar desde la app móvil.'
  } else if (code === 'INVALID_CREDENTIALS' || status === 401) {
    message = 'Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.'
  } else if (status === 403) {
    message = 'Tu perfil no tiene permisos para esta operación. Solicita acceso a un administrador.'
  } else if (code === 'DUPLICATE_ENTRY' || /duplicad|duplicate/i.test(`${code} ${rawMessage}`)) {
    message = 'Esta entrada ya fue registrada. El socio se encuentra actualmente dentro.'
  } else if (code === 'CAPACITY_FULL' || /capacidad|capacity/i.test(`${code} ${rawMessage}`)) {
    message = 'El gimnasio alcanzó su capacidad máxima. Intenta de nuevo en unos minutos.'
  } else if (status === 404) {
    message = 'No encontramos el registro solicitado. Puede que haya sido eliminado.'
  } else if (code === 'VALIDATION_ERROR' || status === 422 || status === 400) {
    message = rawMessage ? `Revisa los datos: ${rawMessage}` : 'Revisa los datos capturados e inténtalo de nuevo.'
  } else if (status === 409) {
    message = rawMessage || 'El registro entró en conflicto con otro movimiento reciente.'
  } else if (status === 429) {
    message = 'Demasiados intentos seguidos. Espera un momento y vuelve a intentarlo.'
  } else if (status >= 500) {
    message = 'El servidor no pudo completar la operación. Inténtalo de nuevo en instantes.'
  } else {
    message = rawMessage || 'No se pudo completar la operación. Inténtalo de nuevo.'
  }

  const error: ApiError = { status, code, message }
  const details = pick(r, 'details', 'errors', 'fields')
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    error.details = details as Record<string, unknown>
  }
  return error
}

function networkError(): ApiError {
  return {
    status: 0,
    code: 'NETWORK_ERROR',
    message: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  }
}

function sessionError(): ApiError {
  return {
    status: 401,
    code: 'SESSION_EXPIRED',
    message: 'Tu sesión venció durante el turno. Inicia sesión de nuevo para continuar.',
  }
}

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}

/* ------------------------------------------------------------------ *
 * Fetch core
 * ------------------------------------------------------------------ */

export interface ApiFetchInit extends Omit<RequestInit, 'headers'> {
  headers?: HeadersInit
  /** Disable the single automatic refresh retry (used by auth endpoints). */
  retry?: boolean
  /** Sent as the Idempotency-Key header on charge requests. */
  idempotencyKey?: string
}

type QueryParams = Record<string, string | number | boolean | undefined>

function buildQuery(params?: QueryParams): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) return undefined
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

let refreshInFlight: Promise<boolean> | null = null

async function performRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
        cache: 'no-store',
      })
      if (!response.ok) return false
      const body = await parseBody(response)
      const r = asRecord(body)
      const principal =
        normalizePrincipal(coalesce(pick(r, 'principal'), pick(r, 'user'))) ?? currentSession?.principal ?? null
      if (!principal) return false
      setSession({
        principal,
        csrfToken: asString(coalesce(pick(r, 'csrfToken'), readCsrfToken())),
      })
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

function isAuthPath(path: string): boolean {
  return path.startsWith('/api/auth/')
}

export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { retry = true, idempotencyKey, ...requestInit } = init
  const method = (requestInit.method ?? 'GET').toUpperCase()
  const headers = new Headers(requestInit.headers)
  if (!headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json')
  }
  const csrf = readCsrfToken()
  if (csrf && method !== 'GET' && method !== 'HEAD') headers.set('X-CSRF-Token', csrf)
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...requestInit,
      headers,
      credentials: 'include',
      cache: requestInit.cache ?? 'no-store',
    })
  } catch {
    throw networkError()
  }

  if (response.status === 401 && retry && !isAuthPath(path)) {
    const refreshed = await performRefresh()
    if (refreshed) {
      return apiFetch<T>(path, { ...init, retry: false })
    }
    clearSession()
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
    throw sessionError()
  }

  const body = await parseBody(response)
  if (!response.ok) throw toApiError(response.status, body)
  return body as T
}

/* ------------------------------------------------------------------ *
 * Domain API
 * ------------------------------------------------------------------ */

export interface ChargeRequest {
  memberId: string
  planId: string
  amount: number
  currency: 'MXN'
  method: PaymentMethod
  idempotencyKey: string
}

export interface VerifyQrResult {
  event: AccessEvent
  status: QrResultStatus
  message: string
}

function normalizeVerification(raw: unknown): VerifyQrResult {
  const r = asRecord(raw)
  const allowed = asBoolean(coalesce(pick(r, 'allowed'), pick(r, 'granted'), pick(r, 'valid'), pick(r, 'success')))
  const reason = asString(coalesce(pick(r, 'reason'), pick(r, 'code'), pick(r, 'message')))
  let status: QrResultStatus = 'invalid'
  if (allowed) status = 'valid'
  else if (/expir|vencid/i.test(reason)) status = 'expired'
  else if (/duplic|duplicate/i.test(reason)) status = 'duplicate'
  return {
    event: normalizeAccessEvent(coalesce(pick(r, 'event'), pick(r, 'accessEvent'), raw)),
    status,
    message: asString(
      coalesce(pick(r, 'message'), pick(r, 'detail'), pick(r, 'reason')),
      allowed ? 'Acceso concedido. Puerta liberada.' : 'No fue posible validar este código.'
    ),
  }
}

export const api = {
  auth: {
    login(email: string, password: string): Promise<unknown> {
      return apiFetch('/api/auth/web/login', {
        method: 'POST',
        retry: false,
        body: JSON.stringify({ email, password, platform: 'web' }),
      })
    },
    me(): Promise<unknown> {
      return apiFetch('/api/auth/me', { retry: false })
    },
    logout(): Promise<unknown> {
      return apiFetch('/api/auth/logout', { method: 'POST', retry: false })
    },
  },

  members: {
    async list(params?: QueryParams): Promise<Paginated<MemberView>> {
      const raw = await apiFetch<unknown>(`/api/members${buildQuery(params)}`)
      return normalizePaginated(raw, normalizeMember, ['members', 'socios'])
    },
    async get(id: string): Promise<MemberView> {
      return normalizeMember(await apiFetch<unknown>(`/api/members/${encodeURIComponent(id)}`))
    },
    async medical(id: string): Promise<{ notes: string }> {
      const raw = await apiFetch<unknown>(`/api/members/${encodeURIComponent(id)}/medical`)
      const r = asRecord(raw)
      const notes = coalesce(pick(r, 'notes'), pick(r, 'medicalNotes'), pick(r, 'content'), raw)
      return { notes: typeof notes === 'string' ? notes : asString(pick(asRecord(notes), 'notes')) }
    },
    async create(input: Record<string, unknown>): Promise<MemberView> {
      return normalizeMember(await apiFetch<unknown>('/api/members', { method: 'POST', body: JSON.stringify(input) }))
    },
    async update(id: string, input: Record<string, unknown>): Promise<MemberView> {
      return normalizeMember(
        await apiFetch<unknown>(`/api/members/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })
      )
    },
  },

  payments: {
    async list(params?: QueryParams): Promise<Paginated<PaymentView>> {
      const raw = await apiFetch<unknown>(`/api/payments${buildQuery(params)}`)
      return normalizePaginated(raw, normalizePayment, ['payments', 'cobros'])
    },
    async charge(input: ChargeRequest): Promise<PaymentView> {
      const raw = await apiFetch<unknown>('/api/payments/charge', {
        method: 'POST',
        idempotencyKey: input.idempotencyKey,
        body: JSON.stringify(input),
      })
      return normalizePayment(raw)
    },
    async refund(id: string, reason = 'Reversión solicitada desde consola'): Promise<PaymentView> {
      return normalizePayment(
        await apiFetch<unknown>(`/api/payments/${encodeURIComponent(id)}/refund`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        })
      )
    },
  },

  cash: {
    async listSessions(params?: QueryParams): Promise<Paginated<CashSessionView>> {
      const raw = await apiFetch<unknown>(`/api/cash-sessions${buildQuery(params)}`)
      return normalizePaginated(raw, normalizeCashSession, ['sessions', 'cashSessions'])
    },
    async openSession(input: { startingAmount: number }): Promise<CashSessionView> {
      return normalizeCashSession(
        await apiFetch<unknown>('/api/cash-sessions', { method: 'POST', body: JSON.stringify(input) })
      )
    },
    async closeSession(id: string, input: { countedAmount: number }): Promise<CashSessionView> {
      return normalizeCashSession(
        await apiFetch<unknown>(`/api/cash-sessions/${encodeURIComponent(id)}/close`, {
          method: 'POST',
          body: JSON.stringify(input),
        })
      )
    },
  },

  access: {
    async occupancy(): Promise<OccupancyView> {
      return normalizeOccupancy(await apiFetch<unknown>('/api/access/occupancy'))
    },
    async verifyQr(payload: Record<string, unknown>): Promise<VerifyQrResult> {
      return normalizeVerification(
        await apiFetch<unknown>('/api/access/verify-qr', { method: 'POST', body: JSON.stringify(payload) })
      )
    },
    async manualCheckin(memberId: string): Promise<VerifyQrResult> {
      return normalizeVerification(
        await apiFetch<unknown>('/api/access/manual-checkin', { method: 'POST', body: JSON.stringify({ memberId }) })
      )
    },
  },

  plans: {
    async list(): Promise<Paginated<PlanView>> {
      const raw = await apiFetch<unknown>('/api/plans')
      return normalizePaginated(raw, normalizePlan, ['plans'])
    },
    async create(input: Record<string, unknown>): Promise<PlanView> {
      return normalizePlan(await apiFetch<unknown>('/api/plans', { method: 'POST', body: JSON.stringify(input) }))
    },
    async update(id: string, input: Record<string, unknown>): Promise<PlanView> {
      return normalizePlan(
        await apiFetch<unknown>(`/api/plans/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })
      )
    },
    async remove(id: string): Promise<void> {
      await apiFetch<unknown>(`/api/plans/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
  },

  staff: {
    async list(): Promise<Paginated<StaffUser>> {
      const raw = await apiFetch<unknown>('/api/staff')
      return normalizePaginated(raw, normalizeStaff, ['staff', 'users'])
    },
    async update(id: string, input: Record<string, unknown>): Promise<StaffUser> {
      return normalizeStaff(
        await apiFetch<unknown>(`/api/staff/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })
      )
    },
  },

  routines: {
    async list(params?: QueryParams): Promise<Paginated<RoutineView>> {
      const raw = await apiFetch<unknown>(`/api/routines${buildQuery(params)}`)
      return normalizePaginated(raw, normalizeRoutine, ['routines'])
    },
    async create(input: Record<string, unknown>): Promise<RoutineView> {
      return normalizeRoutine(await apiFetch<unknown>('/api/routines', { method: 'POST', body: JSON.stringify(input) }))
    },
  },

  workouts: {
    async log(input: Record<string, unknown>): Promise<void> {
      await apiFetch<unknown>('/api/workout-logs', { method: 'POST', body: JSON.stringify(input) })
    },
  },

  nutrition: {
    async list(params?: QueryParams): Promise<Paginated<NutritionPlanView>> {
      const raw = await apiFetch<unknown>(`/api/nutrition-plans${buildQuery(params)}`)
      return normalizePaginated(raw, normalizeNutrition, ['plans', 'nutritionPlans'])
    },
    async create(input: Record<string, unknown>): Promise<NutritionPlanView> {
      return normalizeNutrition(
        await apiFetch<unknown>('/api/nutrition-plans', { method: 'POST', body: JSON.stringify(input) })
      )
    },
  },

  classes: {
    async list(): Promise<Paginated<Record<string, unknown>>> {
      const raw = await apiFetch<unknown>('/api/classes')
      return normalizePaginated(raw, asRecord, ['classes'])
    },
    async create(input: Record<string, unknown>): Promise<Record<string, unknown>> {
      return asRecord(await apiFetch<unknown>('/api/classes', { method: 'POST', body: JSON.stringify(input) }))
    },
    async book(classId: string, memberId: string): Promise<void> {
      await apiFetch<unknown>(`/api/classes/${encodeURIComponent(classId)}/book`, {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      })
    },
  },

  reports: {
    async summary(params?: QueryParams): Promise<ReportSummaryView> {
      return normalizeSummary(await apiFetch<unknown>(`/api/reports/summary${buildQuery(params)}`))
    },
    async audit(params?: QueryParams): Promise<Paginated<AuditLogView>> {
      const raw = await apiFetch<unknown>(`/api/audit-logs${buildQuery(params)}`)
      return normalizePaginated(raw, normalizeAudit, ['logs', 'auditLogs', 'audit'])
    },
  },

  uploads: {
    async presign(fileName: string, contentType: string): Promise<{ url: string; key: string }> {
      const raw = asRecord(
        await apiFetch<unknown>('/api/uploads/presign', {
          method: 'POST',
          body: JSON.stringify({ fileName, contentType }),
        })
      )
      return { url: asString(pick(raw, 'url', 'uploadUrl')), key: asString(pick(raw, 'key')) }
    },
  },
}

export function getPrincipalFromLogin(raw: unknown): Principal | null {
  const r = asRecord(raw)
  return normalizePrincipal(coalesce(pick(r, 'principal'), pick(r, 'user'), raw))
}

export function getLoginRole(raw: unknown): string {
  const r = asRecord(raw)
  const identity = asRecord(coalesce(pick(r, 'principal'), pick(r, 'user'), raw))
  return asString(coalesce(pick(r, 'role'), pick(identity, 'role'))).toUpperCase()
}

export function getCsrfFromLogin(raw: unknown): string {
  return asString(coalesce(pick(asRecord(raw), 'csrfToken'), readCsrfToken()))
}

export function normalizeListFallback<T>(raw: unknown, normalize: (value: unknown) => T): T[] {
  return normalizePaginated(raw, normalize).items
}

export function toNumber(value: unknown, fallback = 0): number {
  return asNumber(value, fallback)
}
