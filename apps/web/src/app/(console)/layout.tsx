import { redirect } from 'next/navigation'
import { ConsoleShell } from './ConsoleShell'
import { fetchServerSession } from '@/lib/server-session'

export const dynamic = 'force-dynamic'

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { principal, sessionError, unauthorized, needsVerification } = await fetchServerSession()

  // Redirects are thrown outside the helper so Next.js can handle them.
  if (needsVerification) redirect('/verify-email?reason=unverified')
  if (unauthorized || principal?.role === 'MEMBER') redirect('/login')

  return (
    <ConsoleShell principal={principal} sessionError={sessionError}>
      {children}
    </ConsoleShell>
  )
}
