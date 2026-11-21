'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import {
  api,
  clearSession,
  hydrateSession,
  readCsrfToken,
  SESSION_EXPIRED_EVENT,
  setSession,
} from '@/lib/api-client'
import { roleLabel } from '@/lib/format'
import { useSession } from '@/lib/use-session'
import type { Principal } from '@/types'
import { Button } from '@/ui/primitives/Button'
import { ThemeIcon } from '@/ui/primitives/ThemeIcon'

interface NavItem {
  href: string
  label: string
  index: string
}

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Operación',
    items: [
      { href: '/dashboard', label: 'Resumen', index: '01' },
      { href: '/members', label: 'Socios', index: '02' },
      { href: '/pos', label: 'Cobro', index: '03' },
      { href: '/access', label: 'Acceso', index: '04' },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { href: '/routines', label: 'Rutinas', index: '05' },
      { href: '/plans', label: 'Planes', index: '06' },
      { href: '/staff', label: 'Equipo', index: '07' },
      { href: '/reports', label: 'Reportes', index: '08' },
    ],
  },
  {
    title: 'Sistema',
    items: [{ href: '/settings', label: 'Configuración', index: '09' }],
  },
]

const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: 'G · D', label: 'Ir a resumen' },
  { keys: 'G · M', label: 'Ir a socios' },
  { keys: 'G · P', label: 'Ir a cobro' },
  { keys: 'G · A', label: 'Ir a acceso' },
  { keys: 'G · R', label: 'Ir a reportes' },
  { keys: '?', label: 'Mostrar esta guía' },
  { keys: 'ESC', label: 'Cerrar paneles' },
]

const SHORTCUT_ROUTES: Record<string, string> = {
  d: '/dashboard',
  m: '/members',
  p: '/pos',
  a: '/access',
  r: '/reports',
}

export interface ConsoleShellProps {
  principal: Principal | null
  sessionError: boolean
  children: ReactNode
}

export function ConsoleShell({ principal, sessionError, children }: ConsoleShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const session = useSession()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const role = session?.principal.role ?? principal?.role ?? null

  useEffect(() => {
    hydrateSession()
    if (principal && !session) setSession({ principal, csrfToken: readCsrfToken() })
    const stored = window.localStorage.getItem('ludus-theme')
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored)
      document.documentElement.dataset.theme = stored
    }
  }, [principal, session])

  useEffect(() => {
    function handleExpiry() {
      clearSession()
      router.replace('/login')
      router.refresh()
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiry)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiry)
  }, [router])

  useEffect(() => {
    let groupPending = false
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === 'Escape') {
        setShortcutsOpen(false)
        groupPending = false
        return
      }
      if (event.key === '?') {
        event.preventDefault()
        setShortcutsOpen((current) => !current)
        return
      }
      if (event.key.toLowerCase() === 'g') {
        groupPending = true
        return
      }
      if (groupPending) {
        const route = SHORTCUT_ROUTES[event.key.toLowerCase()]
        groupPending = false
        if (route) {
          event.preventDefault()
          router.push(route)
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [router])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    try {
      window.localStorage.setItem('ludus-theme', next)
    } catch {
      /* preference is still applied for this session */
    }
  }

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await api.auth.logout()
    } catch {
      /* local logout must work even if the API is unreachable */
    }
    clearSession()
    router.replace('/login')
    router.refresh()
  }

  const currentLabel = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.href === pathname)?.label ?? 'Consola'

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="border-b border-hairline bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-6 py-7 lg:block lg:px-7 lg:py-9">
          <Link href="/dashboard" className="group block">
            <span className="block font-display text-xl font-extrabold uppercase leading-none tracking-[-0.04em] text-ink">
              Ludus<span className="text-volt">.</span>
            </span>
            <span className="mt-2 block text-[9px] font-semibold uppercase tracking-[0.3em] text-muted">
              Consola de operación
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            aria-label="Ver atajos de teclado"
            className="flex h-12 items-center border border-hairline px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted transition-colors duration-300 ease-kinetic hover:text-volt lg:hidden"
          >
            Atajos
          </button>
        </div>

        <nav aria-label="Navegación principal" className="flex gap-2 overflow-x-auto px-4 pb-4 lg:mt-4 lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-4 lg:pb-0">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="shrink-0 lg:mb-8">
              <p className="hidden px-3 pb-3 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted/70 lg:block">
                {group.title}
              </p>
              <ul className="flex lg:block">
                {group.items.map((item) => {
                  const active = pathname === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={[
                          'flex min-h-12 items-center gap-3 whitespace-nowrap border-l-2 px-3 text-[12px] font-semibold uppercase tracking-[0.1em] transition-all duration-300 ease-kinetic',
                          active
                            ? 'border-volt bg-[var(--color-surface-raised)] text-ink'
                            : 'border-transparent text-muted hover:border-hairline hover:text-ink',
                        ].join(' ')}
                      >
                        <span className="tabular text-[9px] text-muted/70">{item.index}</span>
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-hairline px-7 py-6 lg:block">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">Sesión activa</p>
          <p className="mt-2 truncate text-xs text-ink">{session?.principal.email || principal?.email || 'Operador'}</p>
          <div className="mt-4 flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
              {sessionError ? 'Verificando sesión' : 'Sistema en línea'}
            </span>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-5 border-b border-hairline bg-canvas/95 px-5 backdrop-blur md:px-9">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-muted">Ludus GYM</p>
            <p className="truncate font-display text-sm font-extrabold uppercase tracking-[-0.02em] text-ink">{currentLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 md:gap-5">
            {role ? (
              <span className="hidden border border-hairline px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-volt sm:inline-block">
                {roleLabel(role)}
              </span>
            ) : null}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
              title={theme === 'dark' ? 'Tema oscuro' : 'Tema claro'}
              className="flex h-12 w-12 items-center justify-center border border-hairline text-muted transition-colors duration-300 ease-kinetic hover:border-volt/50 hover:text-volt"
            >
              <ThemeIcon theme={theme} />
            </button>
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Atajos de teclado"
              className="hidden h-12 items-center border border-hairline px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted transition-colors duration-300 ease-kinetic hover:text-volt md:flex"
            >
              ? Atajos
            </button>
            <Button variant="ghost" className="min-h-12 px-3 md:px-5" onClick={() => void handleLogout()} loading={loggingOut}>
              Salir
            </Button>
          </div>
        </header>

        {sessionError ? (
          <p className="border-b border-hairline bg-surface px-5 py-3 text-xs text-muted md:px-9">
            No pudimos verificar tu sesión con el servidor. Los datos se recargarán automáticamente al recuperar la conexión.
          </p>
        ) : null}

        <main className="mx-auto w-full max-w-[1500px] px-5 py-10 md:px-9 md:py-12">{children}</main>

        <footer className="flex flex-col gap-2 border-t border-hairline px-5 py-6 text-[10px] uppercase tracking-[0.14em] text-muted md:flex-row md:items-center md:justify-between md:px-9">
          <span>Ludus GYM · Consola interna</span>
          <span className="tabular">Sesión auditada · {roleLabel(role)}</span>
        </footer>
      </div>

      {shortcutsOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar atajos"
            onClick={() => setShortcutsOpen(false)}
            className="absolute inset-0 cursor-default bg-[rgba(5,6,8,0.75)] backdrop-blur-sm"
          />
          <div role="dialog" aria-modal="true" aria-label="Atajos de teclado" className="relative w-full max-w-md border border-hairline bg-surface p-8">
            <div className="flex items-start justify-between gap-6 border-b border-hairline pb-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-volt">Productividad</p>
                <h2 className="mt-2 font-display text-xl font-extrabold uppercase tracking-[-0.03em]">Atajos de teclado</h2>
              </div>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                aria-label="Cerrar"
                className="flex h-12 w-12 items-center justify-center border border-hairline text-muted transition-colors duration-300 ease-kinetic hover:text-volt"
              >
                ✕
              </button>
            </div>
            <ul className="mt-3">
              {SHORTCUTS.map((shortcut) => (
                <li key={shortcut.keys} className="flex items-center justify-between border-b border-hairline py-3">
                  <span className="text-sm text-ink">{shortcut.label}</span>
                  <span className="tabular border border-hairline px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-volt">
                    {shortcut.keys}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs leading-relaxed text-muted">
              Las tablas se recorren con las flechas arriba y abajo; Enter abre el detalle del registro seleccionado.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
