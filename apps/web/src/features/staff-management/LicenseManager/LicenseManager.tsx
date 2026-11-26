'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, getErrorMessage, hydrateSession } from '@/lib/api-client'
import { formatDateTime, roleLabel } from '@/lib/format'
import { useSession } from '@/lib/use-session'
import type { Role, StaffUser } from '@/types'
import { EmptyState } from '@/ui/layout/EmptyState'
import { PageHeader } from '@/ui/layout/PageHeader'
import { Button } from '@/ui/primitives/Button'
import { ConfirmModal } from '@/ui/primitives/ConfirmModal'
import { DenseTable, type DenseColumn } from '@/ui/primitives/DenseTable'
import { StatusBadge } from '@/ui/primitives/StatusBadge'

const ASSIGNABLE_ROLES: Array<{ role: Role; label: string }> = [
  { role: 'STAFF', label: roleLabel('STAFF') },
  { role: 'MANAGER', label: roleLabel('MANAGER') },
  { role: 'OWNER', label: roleLabel('OWNER') },
]

const PERMISSIONS: readonly string[] = [
  'members:read',
  'members:write',
  'members:medical:read',
  'payments:charge',
  'payments:refund',
  'payments:audit',
  'cash:shift:open',
  'cash:shift:close',
  'staff:manage',
  'plans:manage',
  'reports:financial',
  'routines:assign',
  'nutrition:assign',
  'classes:manage',
  'access:checkin',
  'audit:read',
]

const PERMISSION_LABELS: Record<string, string> = {
  'members:read': 'Consultar socios',
  'members:write': 'Crear y editar socios',
  'members:medical:read': 'Consultar información médica',
  'payments:charge': 'Registrar cobros',
  'payments:refund': 'Reembolsar cobros',
  'payments:audit': 'Auditar cobros',
  'cash:shift:open': 'Abrir turno de caja',
  'cash:shift:close': 'Cerrar turno de caja',
  'staff:manage': 'Gestionar equipo y licencias',
  'plans:manage': 'Gestionar planes y precios',
  'reports:financial': 'Consultar reportes financieros',
  'routines:assign': 'Asignar rutinas',
  'nutrition:assign': 'Asignar planes nutricionales',
  'classes:manage': 'Gestionar clases',
  'access:checkin': 'Registrar accesos',
  'audit:read': 'Consultar bitácora de auditoría',
  'gyms:approve': 'Autorizar altas de gimnasios',
}

const MATRIX: Record<Role, readonly string[]> = {
  ADMIN: [...PERMISSIONS, 'gyms:approve'],
  OWNER: PERMISSIONS,
  MANAGER: [
    'members:read', 'members:write', 'members:medical:read', 'payments:charge',
    'cash:shift:open', 'cash:shift:close', 'routines:assign', 'nutrition:assign',
    'classes:manage', 'access:checkin', 'audit:read',
  ],
  STAFF: ['members:read', 'payments:charge', 'cash:shift:open', 'cash:shift:close', 'access:checkin'],
  MEMBER: [],
}

interface PendingChange {
  user: StaffUser
  action: 'role' | 'suspend' | 'reactivate'
  role?: Role
}

export function LicenseManager() {
  const session = useSession()
  const [hydrated, setHydrated] = useState(false)
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    hydrateSession()
    setHydrated(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.staff.list()
      setStaff(result.items)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.principal.role === 'OWNER') void load()
  }, [session?.principal.role, load])

  async function applyChange() {
    if (!pending || saving) return
    setSaving(true)
    setError(null)
    try {
      const input: Record<string, unknown> =
        pending.action === 'role' ? { role: pending.role } : { active: pending.action === 'reactivate' }
      const updated = await api.staff.update(pending.user.id, input)
      setStaff((current) => current.map((user) => (user.id === updated.id ? updated : user)))
      setNotice(
        pending.action === 'role'
          ? `Perfil actualizado a ${roleLabel(pending.role ?? updated.role)}.`
          : pending.action === 'suspend'
            ? 'Licencia suspendida. El usuario no podrá iniciar sesión.'
            : 'Licencia reactivada. El usuario podrá iniciar sesión.'
      )
      setPending(null)
    } catch (changeError) {
      setError(getErrorMessage(changeError))
      setPending(null)
    } finally {
      setSaving(false)
    }
  }

  if (!hydrated || !session) {
    return (
      <>
        <PageHeader
          eyebrow="Gobierno de cuentas"
          title="Equipo y licencias"
          description="Verificando tu perfil para mostrar la administración de licencias."
        />
        <div className="h-64 animate-pulse border border-hairline bg-surface" />
      </>
    )
  }

  if (session.principal.role !== 'OWNER') {
    return (
      <>
        <PageHeader
          eyebrow="Gobierno de cuentas"
          title="Equipo y licencias"
          description="La administración de roles y licencias afecta el acceso de todo el equipo."
        />
        <EmptyState
          eyebrow="Acceso restringido"
          title="Solo propietario"
          description="Esta sección está reservada al propietario de la cuenta. Tu perfil actual no puede modificar licencias ni permisos."
        />
      </>
    )
  }

  const columns: Array<DenseColumn<StaffUser>> = [
    {
      key: 'name',
      header: 'Integrante',
      render: (user) => (
        <span>
          <span className="block font-semibold text-ink">{user.name}</span>
          <span className="block text-xs text-muted">{user.email || 'Sin correo'}</span>
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Perfil',
      render: (user) => (
        <label>
          <span className="sr-only">Perfil de {user.name}</span>
          <select
            value={user.role}
            onChange={(event) => setPending({ user, action: 'role', role: event.target.value as Role })}
            className="h-12 min-w-40 border border-hairline bg-surface px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink outline-none transition-colors duration-300 ease-kinetic focus:border-volt"
          >
            {ASSIGNABLE_ROLES.map((option) => (
              <option key={option.role} value={option.role}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ),
    },
    {
      key: 'status',
      header: 'Licencia',
      render: (user) => <StatusBadge status={user.active ? 'active' : 'inactive'} />,
    },
    {
      key: 'lastActive',
      header: 'Última conexión',
      align: 'right',
      render: (user) => <span className="tabular text-muted">{formatDateTime(user.lastActiveAt)}</span>,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (user) => (
        <Button
          variant="ghost"
          className="min-h-12 px-3"
          onClick={() => setPending({ user, action: user.active ? 'suspend' : 'reactivate' })}
        >
          {user.active ? 'Suspender' : 'Reactivar'}
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Gobierno de cuentas"
        title="Equipo y licencias"
        description="Asigna perfiles, suspende accesos y consulta la matriz de permisos vigente para cada rol."
        actions={
          <Button variant="ghost" onClick={() => void load()} loading={loading}>
            Actualizar
          </Button>
        }
      />

      {notice ? (
        <p role="status" className="mb-6 border-l-2 border-emerald bg-surface px-5 py-3 text-sm text-ink">
          {notice}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="mb-6 flex flex-col gap-4 border-l-2 border-ignition bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{error}</p>
          <Button variant="ghost" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      <DenseTable
        columns={columns}
        rows={staff}
        rowKey={(user) => user.id}
        loading={loading}
        emptyMessage="No hay cuentas de equipo registradas."
        ariaLabel="Licencias del equipo"
      />

      <section className="mt-14">
        <div className="mb-6 border-b border-hairline pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Matriz de permisos</p>
          <h2 className="mt-2 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">Perfiles y alcances</h2>
        </div>
        <div className="grid gap-px border border-hairline bg-[var(--color-hairline)] sm:grid-cols-3">
          {ASSIGNABLE_ROLES.map((option) => (
            <div key={option.role} className="bg-canvas p-6">
              <p className="font-display text-sm font-extrabold tracking-[0.1em] text-volt">{option.label}</p>
              <ul className="mt-5 space-y-2">
                {PERMISSIONS.map((permission) => {
                  const allowed = MATRIX[option.role].includes(permission)
                  return (
                    <li
                      key={permission}
                      className={`flex items-center gap-3 text-xs ${allowed ? 'text-ink' : 'text-muted/50'}`}
                    >
                      <span aria-hidden className={`h-1 w-1 shrink-0 rounded-full ${allowed ? 'bg-emerald' : 'bg-muted/40'}`} />
                      <span>{PERMISSION_LABELS[permission] ?? permission}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <ConfirmModal
        open={pending !== null}
        title={
          pending?.action === 'role'
            ? 'Cambiar perfil de acceso'
            : pending?.action === 'suspend'
              ? 'Suspender licencia'
              : 'Reactivar licencia'
        }
        description={
          pending?.action === 'role'
            ? `El perfil de ${pending.user.name} cambiará a ${pending.role ? roleLabel(pending.role) : ''}. El cambio se aplica en su próxima petición.`
            : pending?.action === 'suspend'
              ? `${pending?.user.name ?? 'Este usuario'} perderá el acceso a la consola de inmediato.`
              : `${pending?.user.name ?? 'Este usuario'} volverá a tener acceso a la consola.`
        }
        confirmLabel={pending?.action === 'suspend' ? 'Suspender' : 'Confirmar'}
        loading={saving}
        destructive={pending?.action === 'suspend'}
        onConfirm={() => void applyChange()}
        onCancel={() => setPending(null)}
      />
    </>
  )
}
