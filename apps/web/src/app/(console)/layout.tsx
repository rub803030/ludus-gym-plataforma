import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ConsoleShell } from './ConsoleShell'
import { apiUrl } from '@/config/env'
import { asRecord, asString, coalesce, normalizePrincipal, pick } from '@/lib/normalize'
import type { Principal } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  if (!cookieStore.get('ludus_sid')) redirect('/login')

  const cookieHeader = cookieStore.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
  let principal: Principal | null = null
  let sessionError = false
  let unauthorized = false

  try {
    const response = await fetch(apiUrl('/api/auth/me', 'server'), {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })
    if (response.status === 401 || response.status === 403) {
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

  // Redirects are thrown outside the try block so Next.js can handle them.
  if (unauthorized || principal?.role === 'MEMBER') redirect('/login')

  return (
    <ConsoleShell principal={principal} sessionError={sessionError}>
      {children}
    </ConsoleShell>
  )
}
