import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { fetchServerSession } from '@/lib/server-session'

export const dynamic = 'force-dynamic'

/**
 * Gate del console global. El endpoint ya exige requireAdmin, pero la ruta
 * también se cierra en el servidor: sin esto, un OWNER veía la pantalla y
 * descubría el alcance antes de recibir el 403 de la API.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { principal, sessionError, unauthorized, needsVerification } = await fetchServerSession()
  if (needsVerification) redirect('/verify-email?reason=unverified')
  if (sessionError || unauthorized || principal?.role !== 'ADMIN') redirect('/login')
  return <>{children}</>
}
