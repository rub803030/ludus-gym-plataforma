'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { api, getErrorMessage } from '@/lib/api-client'
import { formatCurrency, formatNumber, formatTime } from '@/lib/format'
import type { OccupancyView, PaymentView, ReportSummaryView } from '@/types'
import { EmptyState } from '@/ui/layout/EmptyState'
import { PageHeader } from '@/ui/layout/PageHeader'
import { Button } from '@/ui/primitives/Button'
import { MetricSkeleton, Skeleton } from '@/ui/primitives/Skeleton'
import { StatusBadge } from '@/ui/primitives/StatusBadge'

export function Overview() {
  const [summary, setSummary] = useState<ReportSummaryView | null>(null)
  const [occupancy, setOccupancy] = useState<OccupancyView | null>(null)
  const [payments, setPayments] = useState<PaymentView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  const load = useCallback(async (signal: { cancelled: boolean }) => {
    setLoading(true)
    setError(null)
    const [summaryResult, occupancyResult, paymentsResult] = await Promise.allSettled([
      api.reports.summary(),
      api.access.occupancy(),
      api.payments.list({ pageSize: 5 }),
    ])
    if (signal.cancelled) return
    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value)
    else setError(getErrorMessage(summaryResult.reason))
    if (occupancyResult.status === 'fulfilled') setOccupancy(occupancyResult.value)
    if (paymentsResult.status === 'fulfilled') setPayments(paymentsResult.value.items)
    setLoading(false)
  }, [])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshIndex])

  const occupancyPercent = occupancy?.percent ?? 0

  return (
    <>
      <PageHeader
        eyebrow="Centro de operación"
        title="Resumen del turno"
        description="Lectura operativa en tiempo real: piso, cobros y socios. Diseñado para decidir sin abrir cinco pantallas."
        actions={
          <>
            <Link
              href="/access"
              className="inline-flex min-h-12 items-center border border-hairline px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink transition-all duration-300 ease-kinetic hover:border-volt/50 hover:text-volt"
            >
              Registrar acceso
            </Link>
            <Link
              href="/pos"
              className="inline-flex min-h-12 items-center bg-volt px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-canvas transition-all duration-300 ease-kinetic hover:brightness-110 active:scale-[0.98]"
            >
              Nuevo cobro
            </Link>
          </>
        }
      />

      {error ? (
        <div role="alert" className="mb-8 flex flex-col gap-4 border-l-2 border-ignition bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ignition">Datos incompletos</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
          </div>
          <Button variant="ghost" onClick={() => setRefreshIndex((value) => value + 1)}>
            Reintentar
          </Button>
        </div>
      ) : null}

      <section aria-label="Indicadores del turno" className="grid gap-px border border-hairline bg-[var(--color-hairline)] sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-canvas p-6">
          {loading ? (
            <MetricSkeleton />
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Ocupación en vivo</p>
              <p className="tabular mt-5 font-display text-4xl font-extrabold tracking-[-0.03em] text-ink">
                {formatNumber(occupancy?.current ?? 0)}
                <span className="ml-2 text-base font-medium text-muted">/ {formatNumber(occupancy?.capacity ?? 0)}</span>
              </p>
              <div className="mt-5 h-1 w-full bg-[var(--color-surface-raised)]">
                <div className="h-full bg-volt transition-all duration-700 ease-kinetic" style={{ width: `${occupancyPercent}%` }} />
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-muted">
                {occupancyPercent}% de capacidad · {occupancy?.updatedAt ? `actualizado ${formatTime(occupancy.updatedAt)}` : 'sin lectura reciente'}
              </p>
            </>
          )}
        </div>

        <div className="bg-canvas p-6">
          {loading ? (
            <MetricSkeleton />
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Cobros de hoy</p>
              <p className="tabular mt-5 font-display text-4xl font-extrabold tracking-[-0.03em] text-volt">
                {formatCurrency(summary?.todayRevenue ?? 0)}
              </p>
              <p className="mt-5 text-[11px] uppercase tracking-[0.12em] text-muted">
                {formatNumber(summary?.transactionsToday ?? 0)} transacciones · ticket medio {formatCurrency(summary?.averageTicket ?? 0)}
              </p>
            </>
          )}
        </div>

        <div className="bg-canvas p-6">
          {loading ? (
            <MetricSkeleton />
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Socios activos</p>
              <p className="tabular mt-5 font-display text-4xl font-extrabold tracking-[-0.03em] text-ink">
                {formatNumber(summary?.activeMembers ?? 0)}
              </p>
              <p className="mt-5 text-[11px] uppercase tracking-[0.12em] text-muted">Membresías vigentes al día de hoy</p>
            </>
          )}
        </div>

        <div className="bg-canvas p-6">
          {loading ? (
            <MetricSkeleton />
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Vencimientos pendientes</p>
              <p className="tabular mt-5 font-display text-4xl font-extrabold tracking-[-0.03em] text-ignition">
                {formatNumber(summary?.pendingExpirations ?? 0)}
              </p>
              <p className="mt-5 text-[11px] uppercase tracking-[0.12em] text-muted">Requieren contacto o renovación</p>
            </>
          )}
        </div>
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <div className="mb-5 flex items-end justify-between border-b border-hairline pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Últimos movimientos</p>
              <h2 className="mt-2 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">Caja del turno</h2>
            </div>
            <Link href="/reports" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-volt hover:underline">
              Ver reporte
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between border-b border-hairline py-4">
                  <Skeleton width="45%" height={12} />
                  <Skeleton width="18%" height={12} />
                </div>
              ))}
            </div>
          ) : payments.length === 0 ? (
            <EmptyState
              eyebrow="Caja en espera"
              title="Turno sin movimientos"
              description="Aún no hay movimientos en este turno. El primer cobro aparecerá aquí."
              action={
                <Link
                  href="/pos"
                  className="inline-flex min-h-12 items-center bg-volt px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-canvas transition-all duration-300 ease-kinetic hover:brightness-110"
                >
                  Abrir cobro
                </Link>
              }
            />
          ) : (
            <ul>
              {payments.map((payment) => (
                <li key={payment.id} className="flex flex-col gap-2 border-b border-hairline py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">{payment.memberName}</p>
                    <p className="tabular mt-1 text-[11px] uppercase tracking-[0.1em] text-muted">
                      {payment.planName} · {payment.reference} · {payment.createdAt ? formatTime(payment.createdAt) : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={payment.status} />
                    <span className="tabular text-sm font-bold text-volt">{formatCurrency(payment.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-5 border-b border-hairline pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Accesos por zona</p>
            <h2 className="mt-2 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">Piso en vivo</h2>
          </div>
          {loading ? (
            <div className="space-y-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} height={28} />
              ))}
            </div>
          ) : occupancy?.zones && occupancy.zones.length > 0 ? (
            <ul className="space-y-6">
              {occupancy.zones.map((zone) => {
                const percent = Math.min(100, Math.round((zone.current / Math.max(zone.capacity, 1)) * 100))
                return (
                  <li key={zone.name}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-ink">{zone.name}</span>
                      <span className="tabular text-sm font-semibold text-muted">
                        {zone.current} / {zone.capacity}
                      </span>
                    </div>
                    <div className="mt-2 h-1 bg-[var(--color-surface-raised)]">
                      <div className="h-full bg-emerald transition-all duration-700 ease-kinetic" style={{ width: `${percent}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              eyebrow="Sin sensores"
              title="Zonas sin reporte"
              description="La lectura de ocupación por zona aparecerá cuando el control de acceso reporte su primer evento."
            />
          )}
        </section>
      </div>
    </>
  )
}
