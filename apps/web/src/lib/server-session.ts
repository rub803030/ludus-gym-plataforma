import { cookies } from 'next/headers'
import { apiUrl } from '@/config/env'
import { asRecord, asString, coalesce, normalizePrincipal, pick } from '@/lib/normalize'
import type { Principal } from '@/types'

export interface ServerSessionResult {
  principal: Principal | null
  sessionError: boolean
  unauthorized: boolean
  needsVerification: boolean
}

/**
 * Lee la sesión del console en el servidor con las cookies de la request.
 * No redirige aquí: cada layout decide a dónde, para que `redirect()` se
 * lance fuera de un bloque try/catch (Next lo implementa lanzando una excepción).
 */
export async function fetchServerSession(): Promise<ServerSessionResult> {
  const cookieStore = cookies()
  if (!cookieStore.get('ludus_sid')) {
    return { principal: null, sessionError: false, unauthorized: true, needsVerification: false }
  }

  const cookieHeader = cookieStore.getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')

  let principal: Principal | null = null
  let sessionError = false
  let unauthorized = false
  let needsVerification = false

  try {
    const response = await fetch(apiUrl('/api/auth/me', 'server'), {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })
    if (response.status === 403) {
      const rawError: unknown = await response.json().catch(() => ({}))
      const error = asRecord(pick(asRecord(rawError), 'error'))
      needsVerification = asString(pick(error, 'code')) === 'EMAIL_NOT_VERIFIED'
      unauthorized = true
    } else if (response.status === 401) {
      unauthorized = true
    } else if (response.ok) {
      const raw: unknown = await response.json()
      const me = asRecord(raw)
      const identity = asRecord(coalesce(pick(me, 'principal'), pick(me, 'user')))
      const role = asString(coalesce(pick(me, 'role'), pick(identity, 'role'))).toUpperCase()
      if (role === 'MEMBER') unauthorized = true
      principal = normalizePrincipal(raw)
      if (!principal) sessionError = true
    } else {
      sessionError = true
    }
  } catch {
    sessionError = true
  }

  return { principal, sessionError, unauthorized, needsVerification }
}
