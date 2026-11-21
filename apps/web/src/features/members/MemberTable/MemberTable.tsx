'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, getErrorMessage, hydrateSession } from '@/lib/api-client'
import { formatCurrency, formatDate, initials } from '@/lib/format'
import { useSession } from '@/lib/use-session'
import type { MemberStatus, MemberView, PaymentView } from '@/types'
import { EmptyState } from '@/ui/layout/EmptyState'
import { PageHeader } from '@/ui/layout/PageHeader'
import { DenseTable, type DenseColumn } from '@/ui/primitives/DenseTable'
import { Button } from '@/ui/primitives/Button'
import { StatusBadge } from '@/ui/primitives/StatusBadge'

const PAGE_SIZE = 10
const STATUS_OPTIONS: Array<{ value: 'all' | MemberStatus; label: string }> = [
  { value: 'all', label: 'Todos los estatus' },
  { value: 'active', label: 'Activos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'expired', label: 'Vencidos' },
  { value: 'overdue', label: 'Atrasados' },
  { value: 'inactive', label: 'Inactivos' },
]

interface MemberDetail {
  member: MemberView
  notes: string | null
  payments: PaymentView[]
  loading: boolean
  error: string | null
  canReadMedical: boolean
}

export function MemberTable() {
  const session = useSession()
  const [members, setMembers] = useState<MemberView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | MemberStatus>('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    hydrateSession()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.members.list({ page: 1, pageSize: 200 })
      setMembers(result.items)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return members.filter((member) => {
      const matchesStatus = status === 'all' || member.status === status
      const matchesQuery =
        !needle ||
        member.fullName.toLowerCase().includes(needle) ||
        member.email.toLowerCase().includes(needle) ||
        member.document.toLowerCase().includes(needle)
      return matchesStatus && matchesQuery
    })
  }, [members, query, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const openDetail = useCallback(
    async (member: MemberView) => {
      const canReadMedical = session?.principal.role === 'OWNER' || session?.principal.role === 'MANAGER'
      setDetail({
        member,
        notes: null,
        payments: [],
        loading: true,
        error: null,
        canReadMedical,
      })
      const [memberResult, paymentsResult, medicalResult] = await Promise.allSettled([
        api.members.get(member.id),
        api.payments.list({ memberId: member.id, pageSize: 20 }),
        canReadMedical ? api.members.medical(member.id) : Promise.resolve(null),
      ])
      setDetail((current) => {
        if (!current || current.member.id !== member.id) return current
        const errors = [memberResult, paymentsResult, medicalResult]
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map((result) => getErrorMessage(result.reason))
        return {
          ...current,
          member: memberResult.status === 'fulfilled' ? memberResult.value : current.member,
          payments: paymentsResult.status === 'fulfilled' ? paymentsResult.value.items : [],
          notes: medicalResult.status === 'fulfilled' ? (medicalResult.value?.notes ?? null) : null,
          loading: false,
          error: errors[0] ?? null,
        }
      })
    },
    [session?.principal.role]
  )

  useEffect(() => {
    if (!detail) return
    closeRef.current?.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setDetail(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [detail?.member.id, detail])

  const columns: Array<DenseColumn<MemberView>> = [
    {
      key: 'member',
      header: 'Socio',
      render: (member) => (
        <div className="flex items-center gap-3">
          <span className="tabular flex h-8 w-8 shrink-0 items-center justify-center border border-hairline text-[10px] font-bold text-volt">
            {initials(member.fullName)}
          </span>
          <span className="block">
            <span className="block font-semibold text-ink">{member.fullName}</span>
            <span className="block text-xs text-muted">{member.email || 'Sin correo registrado'}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'document',
      header: 'Documento',
      render: (member) => <span className="tabular text-muted">{member.document || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Estatus',
      render: (member) => <StatusBadge status={member.status} />,
    },
    {
      key: 'plan',
      header: 'Membresía',
      render: (member) => <span className="text-muted">{member.membership?.planName ?? 'Sin asignar'}</span>,
    },
    {
      key: 'expiry',
      header: 'Vencimiento',
      align: 'right',
      render: (member) => (
        <span className="tabular text-muted">{formatDate(member.membership?.endDate)}</span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (member) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            void openDetail(member)
          }}
          className="min-h-12 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-volt transition-colors duration-300 ease-kinetic hover:text-ink"
        >
          Ver detalle →
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Base de socios"
        title="Socios"
        description="Expediente operativo, vigencia de membresía e historial de cobros. El detalle médico solo aparece para perfiles autorizados."
        actions={
          <Button variant="ghost" onClick={() => void load()} loading={loading}>
            Actualizar
          </Button>
        }
      />

      <div className="mb-7 flex flex-col gap-4 md:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar socio</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Buscar por nombre, correo o documento…"
            className="h-12 w-full border border-hairline bg-surface px-4 pr-10 text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/60 focus:border-volt"
          />
          <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">
            /
          </span>
        </label>
        <label className="md:w-64">
          <span className="sr-only">Filtrar por estatus</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as 'all' | MemberStatus)
              setPage(1)
            }}
            className="h-12 w-full border border-hairline bg-surface px-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink outline-none transition-colors duration-300 ease-kinetic focus:border-volt"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

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
        rows={pageRows}
        rowKey={(member) => member.id}
        loading={loading}
        emptyMessage="No encontramos socios con esos criterios. Ajusta la búsqueda o el filtro."
        onRowClick={(member) => void openDetail(member)}
        ariaLabel="Listado de socios"
      />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="tabular text-[11px] uppercase tracking-[0.14em] text-muted">
          {filtered.length} registros · Página {currentPage} de {totalPages}
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)}>
            Anterior
          </Button>
          <Button variant="ghost" disabled={currentPage >= totalPages} onClick={() => setPage((value) => value + 1)}>
            Siguiente
          </Button>
        </div>
      </div>

      {detail ? (
        <div className="fixed inset-0 z-[90] flex justify-end">
          <button
            type="button"
            aria-label="Cerrar detalle"
            onClick={() => setDetail(null)}
            className="absolute inset-0 cursor-default bg-[rgba(5,6,8,0.7)] backdrop-blur-sm"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle de ${detail.member.fullName}`}
            className="relative h-full w-full max-w-xl overflow-y-auto border-l border-hairline bg-canvas p-7 md:p-10"
          >
            <div className="flex items-start justify-between gap-6 border-b border-hairline pb-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-volt">Expediente de socio</p>
                <h2 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-[-0.03em]">
                  {detail.member.fullName}
                </h2>
                <p className="mt-2 text-sm text-muted">{detail.member.email || 'Sin correo registrado'}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Cerrar"
                className="flex h-12 w-12 shrink-0 items-center justify-center border border-hairline text-muted transition-colors duration-300 ease-kinetic hover:border-volt/50 hover:text-volt"
              >
                ✕
              </button>
            </div>

            {detail.loading ? (
              <div className="mt-8 space-y-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-10 border-b border-hairline bg-surface/60" />
                ))}
              </div>
            ) : (
              <div className="mt-8 space-y-10">
                {detail.error ? (
                  <p role="alert" className="border-l-2 border-ignition bg-surface px-4 py-3 text-sm text-muted">
                    {detail.error}
                  </p>
                ) : null}

                <section>
                  <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Membresía</h3>
                  {detail.member.membership ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-hairline pt-5">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Plan</p>
                        <p className="mt-2 text-sm font-semibold">{detail.member.membership.planName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Estatus</p>
                        <div className="mt-2"><StatusBadge status={detail.member.membership.status} /></div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Inicio</p>
                        <p className="tabular mt-2 text-sm">{formatDate(detail.member.membership.startDate)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Vencimiento</p>
                        <p className="tabular mt-2 text-sm">{formatDate(detail.member.membership.endDate)}</p>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      eyebrow="Sin plan"
                      title="Membresía no asignada"
                      description="Este socio aún no tiene una membresía vigente. Puedes asignarla desde el punto de venta."
                    />
                  )}
                </section>

                <section>
                  <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Notas médicas</h3>
                  {detail.canReadMedical ? (
                    detail.notes ? (
                      <p className="border-l-2 border-volt bg-surface px-4 py-4 text-sm leading-relaxed text-ink">
                        {detail.notes}
                      </p>
                    ) : (
                      <p className="text-sm text-muted">Sin notas médicas registradas.</p>
                    )
                  ) : (
                    <p className="border-l-2 border-hairline px-4 py-3 text-sm text-muted">
                      Información clínica restringida al propietario y al encargado.
                    </p>
                  )}
                </section>

                <section>
                  <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Historial de pagos</h3>
                  {detail.payments.length === 0 ? (
                    <p className="text-sm text-muted">Aún no hay cobros registrados para este socio.</p>
                  ) : (
                    <ul>
                      {detail.payments.map((payment) => (
                        <li key={payment.id} className="flex items-center justify-between border-b border-hairline py-3">
                          <span>
                            <span className="block text-sm text-ink">{payment.planName}</span>
                            <span className="tabular block text-[11px] text-muted">{formatDate(payment.createdAt)} · {payment.reference}</span>
                          </span>
                          <span className="tabular text-sm font-bold text-volt">{formatCurrency(payment.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </>
  )
}
