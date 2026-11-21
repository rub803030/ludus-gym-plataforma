'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, getErrorMessage, hydrateSession } from '@/lib/api-client'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format'
import { useSession } from '@/lib/use-session'
import type { AuditLogView, PaymentView, ReportSummaryView } from '@/types'
import { EmptyState } from '@/ui/layout/EmptyState'
import { PageHeader } from '@/ui/layout/PageHeader'
import { Button } from '@/ui/primitives/Button'
import { ConfirmModal } from '@/ui/primitives/ConfirmModal'
import { DenseTable, type DenseColumn } from '@/ui/primitives/DenseTable'
import { StatusBadge } from '@/ui/primitives/StatusBadge'

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
]

export function CashAudit() {
  const session = useSession()
  const [hydrated, setHydrated] = useState(false)
  const [days, setDays] = useState(30)
  const [summary, setSummary] = useState<ReportSummaryView | null>(null)
  const [payments, setPayments] = useState<PaymentView[]>([])
  const [audit, setAudit] = useState<AuditLogView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [refundTarget, setRefundTarget] = useState<PaymentView | null>(null)
  const [refunding, setRefunding] = useState(false)

  useEffect(() => {
    hydrateSession()
    setHydrated(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [summaryResult, paymentResult, auditResult] = await Promise.allSettled([
      api.reports.summary({ days }),
      api.payments.list({ pageSize: 50, days }),
      api.reports.audit({ pageSize: 50, days }),
    ])
    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value)
    if (paymentResult.status === 'fulfilled') setPayments(paymentResult.value.items)
    if (auditResult.status === 'fulfilled') setAudit(auditResult.value.items)
    const failures = [summaryResult, paymentResult, auditResult].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )
    if (failures.length > 0) setError(getErrorMessage(failures[0]?.reason))
    setLoading(false)
  }, [days])

  useEffect(() => {
    if (session?.principal.role === 'OWNER') void load()
  }, [session?.principal.role, load])

  async function handleRefund() {
    if (!refundTarget || refunding) return
    setRefunding(true)
    setError(null)
    const target = refundTarget
    setPayments((current) =>
      current.map((payment) => (payment.id === target.id ? { ...payment, status: 'pending' } : payment))
    )
    try {
      const refunded = await api.payments.refund(target.id)
      setPayments((current) => current.map((payment) => (payment.id === target.id ? refunded : payment)))
      setNotice(`Reembolso de ${formatCurrency(refunded.amount)} registrado correctamente.`)
      setRefundTarget(null)
    } catch (refundError) {
      setPayments((current) =>
        current.map((payment) => (payment.id === target.id ? { ...payment, status: 'paid' } : payment))
      )
      setError(getErrorMessage(refundError))
      setRefundTarget(null)
    } finally {
      setRefunding(false)
    }
  }

  if (!hydrated || !session) {
    return (
      <>
        <PageHeader
          eyebrow="Analítica y trazabilidad"
          title="Reportes y auditoría"
          description="Verificando tu sesión para mostrar la información financiera."
        />
        <div className="h-64 animate-pulse border border-hairline bg-surface" />
      </>
    )
  }

  if (session.principal.role !== 'OWNER') {
    return (
      <>
        <PageHeader
          eyebrow="Analítica y trazabilidad"
          title="Reportes y auditoría"
          description="Información financiera y bitácora de acciones sensibles."
        />
        <EmptyState
          eyebrow="Acceso restringido"
          title="Solo propietario"
          description="Los reportes financieros y la bitácora de auditoría están disponibles únicamente para el propietario de la cuenta."
        />
      </>
    )
  }

  const maxBar = Math.max(1, ...(summary?.revenueByDay ?? []).map((item) => item.amount))

  const paymentColumns: Array<DenseColumn<PaymentView>> = [
    {
      key: 'member',
      header: 'Socio',
      render: (payment) => (
        <span>
          <span className="block font-semibold text-ink">{payment.memberName}</span>
          <span className="tabular block text-xs text-muted">{payment.reference}</span>
        </span>
      ),
    },
    { key: 'plan', header: 'Concepto', render: (payment) => <span className="text-muted">{payment.planName}</span> },
    {
      key: 'method',
      header: 'Método',
      render: (payment) => <span className="text-xs uppercase tracking-[0.12em] text-muted">{payment.method}</span>,
    },
    {
      key: 'date',
      header: 'Fecha',
      align: 'right',
      render: (payment) => <span className="tabular text-muted">{formatDateTime(payment.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'Estatus',
      align: 'right',
      render: (payment) => <StatusBadge status={payment.status} />,
    },
    {
      key: 'amount',
      header: 'Monto',
      align: 'right',
      render: (payment) => <span className="tabular font-bold text-volt">{formatCurrency(payment.amount)}</span>,
    },
    {
      key: 'refund',
      header: '',
      align: 'right',
      render: (payment) => (
        <Button
          variant="ghost"
          className="min-h-12 px-3"
          disabled={payment.status !== 'paid'}
          onClick={() => setRefundTarget(payment)}
        >
          Reembolsar
        </Button>
      ),
    },
  ]

  const auditColumns: Array<DenseColumn<AuditLogView>> = [
    {
      key: 'at',
      header: 'Cuándo',
      render: (log) => <span className="tabular text-muted">{formatDateTime(log.at)}</span>,
    },
    { key: 'actor', header: 'Actor', render: (log) => <span className="font-semibold text-ink">{log.actor}</span> },
    { key: 'action', header: 'Acción', render: (log) => <span className="text-ink/90">{log.action}</span> },
    { key: 'target', header: 'Objeto', render: (log) => <span className="font-mono text-xs text-muted">{log.target || '—'}</span> },
    {
      key: 'severity',
      header: 'Nivel',
      align: 'right',
      render: (log) => (
        <StatusBadge
          status={log.severity}
          label={log.severity === 'critical' ? 'Crítico' : log.severity === 'warning' ? 'Atención' : 'Información'}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Analítica y trazabilidad"
        title="Reportes y auditoría"
        description="Caja, tendencia de ingresos y bitácora de operaciones sensibles. Solo lectura para el propietario."
        actions={
          <div className="flex gap-px border border-hairline bg-[var(--color-hairline)]">
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                onClick={() => setDays(range.days)}
                className={[
                  'min-h-12 px-4 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-300 ease-kinetic',
                  days === range.days ? 'bg-volt text-canvas' : 'bg-surface text-muted hover:text-ink',
                ].join(' ')}
              >
                {range.label}
              </button>
            ))}
          </div>
        }
      />

      {notice ? <p role="status" className="mb-6 border-l-2 border-emerald bg-surface px-5 py-3 text-sm">{notice}</p> : null}
      {error ? (
        <div role="alert" className="mb-6 flex flex-col gap-4 border-l-2 border-ignition bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{error}</p>
          <Button variant="ghost" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      <section className="grid gap-px border border-hairline bg-[var(--color-hairline)] sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Ingresos del día', value: formatCurrency(summary?.todayRevenue ?? 0), tone: 'text-volt' },
          { label: 'Transacciones', value: formatNumber(summary?.transactionsToday ?? 0), tone: 'text-ink' },
          { label: 'Ticket medio', value: formatCurrency(summary?.averageTicket ?? 0), tone: 'text-ink' },
          { label: 'Socios activos', value: formatNumber(summary?.activeMembers ?? 0), tone: 'text-ink' },
        ].map((metric) => (
          <div key={metric.label} className="bg-canvas p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{metric.label}</p>
            <p className={`tabular mt-5 font-display text-3xl font-extrabold tracking-[-0.04em] ${metric.tone}`}>
              {loading ? '—' : metric.value}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <div className="mb-6 border-b border-hairline pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Tendencia</p>
          <h2 className="mt-2 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">Ingresos por día</h2>
        </div>
        {loading ? (
          <div className="h-48 animate-pulse border border-hairline bg-surface" />
        ) : summary?.revenueByDay && summary.revenueByDay.length > 0 ? (
          <div className="flex h-56 items-end gap-3 border-b border-hairline pb-px">
            {summary.revenueByDay.map((item, index) => (
              <div key={`${item.label}-${index}`} className="group flex h-full flex-1 flex-col justify-end gap-2">
                <span className="tabular text-center text-[10px] text-muted opacity-0 transition-opacity duration-300 ease-kinetic group-hover:opacity-100">
                  {formatCurrency(item.amount)}
                </span>
                <div
                  className="w-full bg-volt/80 transition-all duration-700 ease-kinetic hover:bg-volt"
                  style={{ height: `${Math.max(3, (item.amount / maxBar) * 100)}%` }}
                  title={`${item.label}: ${formatCurrency(item.amount)}`}
                />
                <span className="tabular truncate text-center text-[9px] uppercase tracking-[0.08em] text-muted">{item.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            eyebrow="Sin datos"
            title="Sin serie de ingresos"
            description="Cuando existan cobros en el periodo seleccionado, la tendencia diaria se dibujará aquí."
          />
        )}
      </section>

      <section className="mt-14">
        <div className="mb-5 border-b border-hairline pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Transacciones</p>
          <h2 className="mt-2 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">Cobros del periodo</h2>
        </div>
        <DenseTable
          columns={paymentColumns}
          rows={payments}
          rowKey={(payment) => payment.id}
          loading={loading}
          emptyMessage="No hubo cobros en el periodo seleccionado."
          ariaLabel="Cobros del periodo"
        />
      </section>

      <section className="mt-14">
        <div className="mb-5 border-b border-hairline pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Bitácora</p>
          <h2 className="mt-2 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">Registro de auditoría</h2>
        </div>
        <DenseTable
          columns={auditColumns}
          rows={audit}
          rowKey={(log) => log.id}
          loading={loading}
          emptyMessage="No se registraron acciones sensibles en el periodo."
          ariaLabel="Registro de auditoría"
        />
      </section>

      <ConfirmModal
        open={refundTarget !== null}
        title="Reembolsar cobro"
        description={`¿Reembolsar ${formatCurrency(refundTarget?.amount ?? 0)} del cobro ${refundTarget?.reference ?? ''}? La operación quedará registrada en auditoría.`}
        confirmLabel="Confirmar reembolso"
        loading={refunding}
        onConfirm={() => void handleRefund()}
        onCancel={() => setRefundTarget(null)}
      />
    </>
  )
}
