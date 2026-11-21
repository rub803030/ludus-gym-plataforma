'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api, clearSession, hydrateSession } from '@/lib/api-client'
import { roleLabel } from '@/lib/format'
import { useSession } from '@/lib/use-session'
import { PageHeader } from '@/ui/layout/PageHeader'
import { Button } from '@/ui/primitives/Button'
import { ThemeToggle } from '@/ui/primitives/ThemeToggle'

export default function SettingsPage() {
  const router = useRouter()
  const session = useSession()
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    hydrateSession()
  }, [])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await api.auth.logout()
    } catch {
      /* clear local state even when the API cannot be reached */
    }
    clearSession()
    router.replace('/login')
    router.refresh()
  }

  const principal = session?.principal

  return (
    <>
      <PageHeader
        eyebrow="Preferencias"
        title="Configuración"
        description="Apariencia de la consola y detalle de la sesión operativa actual."
      />

      <div className="grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="mb-5 border-b border-hairline pb-4 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">
            Apariencia
          </h2>
          <p className="text-sm leading-relaxed text-muted">
            Estilo Kinetic Obsidiana: superficies tonales, divisores de un pixel y acentos de alto contraste.
          </p>
          <div className="mt-6">
            <ThemeToggle variant="labeled" />
          </div>
        </section>

        <section>
          <h2 className="mb-5 border-b border-hairline pb-4 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">
            Sesión
          </h2>
          <dl className="grid grid-cols-1 gap-y-5 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Perfil</dt>
              <dd className="mt-2 text-sm font-bold text-volt">{roleLabel(principal?.role)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Gimnasio</dt>
              <dd className="mt-2 text-sm text-ink">{principal?.gymId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Operador</dt>
              <dd className="mt-2 text-sm text-ink">{principal?.name ?? principal?.email ?? principal?.id ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Identificador</dt>
              <dd className="tabular mt-2 truncate text-xs text-muted">{principal?.id ?? '—'}</dd>
            </div>
          </dl>
          <div className="mt-8 border-t border-hairline pt-6">
            <Button variant="destructive" onClick={() => void handleLogout()} loading={loggingOut}>
              Cerrar sesión
            </Button>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Al salir se invalidan las cookies de sesión y se limpia el perfil almacenado en este navegador.
            </p>
          </div>
        </section>
      </div>
    </>
  )
}
