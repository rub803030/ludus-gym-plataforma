'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  api,
  createIdempotencyKey,
  getErrorMessage,
  type ChargeRequest,
} from '@/lib/api-client'
import { formatCurrency, formatDateTime, initials } from '@/lib/format'
import type { MemberView, PaymentMethod, PaymentView, PlanView } from '@/types'
import { Button } from '@/ui/primitives/Button'
import { NumericInput } from '@/ui/primitives/NumericInput'
import { PageHeader } from '@/ui/layout/PageHeader'
import { QrCode } from '@/ui/primitives/QrCode'
import { StatusBadge } from '@/ui/primitives/StatusBadge'

const METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
]

export function CheckoutPanel() {
  const [members, setMembers] = useState<MemberView[]>([])
  const [plans, setPlans] = useState<PlanView[]>([])
  const [recent, setRecent] = useState<PaymentView[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [memberId, setMemberId] = useState('')
  const [planId, setPlanId] = useState('')
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<PaymentView | null>(null)
  const [idempotencyReady, setIdempotencyReady] = useState(false)
  const lockRef = useRef(false)
  const idempotencyRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoadingData(true)
    const [memberResult, planResult, paymentResult] = await Promise.allSettled([
      api.members.list({ pageSize: 200 }),
      api.plans.list(),
      api.payments.list({ pageSize: 6 }),
    ])
    if (memberResult.status === 'fulfilled') setMembers(memberResult.value.items)
    if (planResult.status === 'fulfilled') setPlans(planResult.value.items.filter((plan) => plan.active))
    if (paymentResult.status === 'fulfilled') setRecent(paymentResult.value.items)
    setLoadingData(false)
  }, [])

  useEffect(() => {
    void load()
    idempotencyRef.current = createIdempotencyKey()
    setIdempotencyReady(true)
  }, [load])

  const filteredMembers = useMemo(() => {
    const needle = memberQuery.trim().toLowerCase()
    if (!needle) return members.slice(0, 8)
    return members
      .filter(
        (member) =>
          member.fullName.toLowerCase().includes(needle) ||
          member.document.toLowerCase().includes(needle) ||
          member.email.toLowerCase().includes(needle)
      )
      .slice(0, 8)
  }, [members, memberQuery])

  const selectedMember = members.find((member) => member.id === memberId) ?? null
  const selectedPlan = plans.find((plan) => plan.id === planId) ?? null

  useEffect(() => {
    if (selectedPlan) setAmount(selectedPlan.price)
  }, [selectedPlan])

  function resetCheckout() {
    setReceipt(null)
    setMemberId('')
    setMemberQuery('')
    setPlanId('')
    setAmount(0)
    setMethod('cash')
    setError(null)
    idempotencyRef.current = createIdempotencyKey()
  }

  async function handleCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lockRef.current || submitting || !idempotencyReady || !idempotencyRef.current) return
    if (!memberId || !planId || amount <= 0) {
      setError('Selecciona un socio, un plan y captura un monto mayor a cero.')
      return
    }
    lockRef.current = true
    setSubmitting(true)
    setError(null)

    const optimisticId = `optimistic-${Date.now()}`
    const optimistic: PaymentView = {
      id: optimisticId,
      memberId,
      memberName: selectedMember?.fullName ?? 'Socio',
      planName: selectedPlan?.name ?? 'Plan',
      amount,
      currency: 'MXN',
      method,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reference: 'PROCESANDO',
      receiptCode: 'PENDIENTE',
    }
    setRecent((current) => [optimistic, ...current].slice(0, 6))

    const request: ChargeRequest = {
      memberId,
      planId,
      amount: Math.round(amount),
      currency: 'MXN',
      method,
      idempotencyKey: idempotencyRef.current,
    }

    try {
      const payment = await api.payments.charge(request)
      setRecent((current) => current.map((item) => (item.id === optimisticId ? payment : item)))
      setReceipt(payment)
      idempotencyRef.current = createIdempotencyKey()
    } catch (chargeError) {
      setRecent((current) => current.filter((item) => item.id !== optimisticId))
      setError(getErrorMessage(chargeError))
      idempotencyRef.current = createIdempotencyKey()
    } finally {
      lockRef.current = false
      setSubmitting(false)
    }
  }

  if (receipt) {
    return (
      <>
        <PageHeader
          eyebrow="Punto de venta"
          title="Cobro confirmado"
          description="Comprobante listo para entregar al socio. El cargo quedó registrado en la caja del turno."
        />
        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <section className="border border-hairline bg-surface p-8 md:p-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-volt">Recibo digital</p>
            <p className="tabular mt-6 font-display text-5xl font-extrabold tracking-[-0.05em] text-ink">
              {formatCurrency(receipt.amount)}
            </p>
            <p className="mt-3 text-sm text-muted">
              {receipt.planName} · {receipt.memberName}
            </p>
            <dl className="mt-10 grid gap-x-10 gap-y-6 border-t border-hairline pt-8 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Folio</dt>
                <dd className="tabular mt-2 text-sm font-semibold">{receipt.reference}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Fecha</dt>
                <dd className="tabular mt-2 text-sm font-semibold">{formatDateTime(receipt.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Método</dt>
                <dd className="mt-2 text-sm font-semibold uppercase">
                  {METHODS.find((item) => item.value === receipt.method)?.label ?? receipt.method}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">Estatus</dt>
                <dd className="mt-2"><StatusBadge status={receipt.status} /></dd>
              </div>
            </dl>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button onClick={resetCheckout}>Nuevo cobro</Button>
              <Link
                href="/members"
                className="inline-flex min-h-12 items-center justify-center border border-hairline px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink transition-colors duration-300 ease-kinetic hover:border-volt/50 hover:text-volt"
              >
                Ver socio
              </Link>
            </div>
          </section>

          <aside className="flex flex-col items-center justify-start border border-hairline bg-surface p-8 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Código de comprobante</p>
            <div className="mt-6 border border-hairline bg-white p-4">
              <QrCode value={receipt.receiptCode} size={148} />
            </div>
            <p className="tabular mt-5 text-sm font-bold tracking-[0.14em] text-ink">{receipt.receiptCode}</p>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              El socio puede presentar este código en recepción para validar su pago.
            </p>
          </aside>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Punto de venta"
        title="Cobro en caja"
        description="Cada cargo envía una llave de idempotencia: si la red falla, repetir el envío nunca duplicará el cobro."
        actions={
          <Button variant="ghost" onClick={() => void load()} loading={loadingData}>
            Actualizar catálogo
          </Button>
        }
      />

      {error ? (
        <div role="alert" className="mb-8 flex flex-col gap-4 border-l-2 border-ignition bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ignition">Cobro no completado</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{error}</p>
          </div>
          <Link
            href="/members"
            className="inline-flex min-h-12 shrink-0 items-center border border-hairline px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-volt transition-colors duration-300 ease-kinetic hover:border-volt/50"
          >
            Ir a socios
          </Link>
        </div>
      ) : null}

      <form onSubmit={(event) => void handleCharge(event)} className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <section className="space-y-10">
          <div>
            <div className="mb-4 flex items-baseline justify-between border-b border-hairline pb-3">
              <h2 className="font-display text-lg font-extrabold uppercase tracking-[-0.03em]">01 · Socio</h2>
              <span className="tabular text-[10px] uppercase tracking-[0.14em] text-muted">{members.length} en base</span>
            </div>
            <input
              type="search"
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="Buscar socio por nombre, documento o correo…"
              aria-label="Buscar socio"
              className="h-12 w-full border border-hairline bg-surface px-4 text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/60 focus:border-volt"
            />
            <div className="mt-3 max-h-72 overflow-y-auto border border-hairline">
              {filteredMembers.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  {loadingData ? 'Cargando socios…' : 'Sin resultados. Ajusta la búsqueda.'}
                </p>
              ) : (
                filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      setMemberId(member.id)
                      setMemberQuery(member.fullName)
                    }}
                    className={[
                      'flex min-h-12 w-full items-center justify-between gap-4 border-b border-hairline px-4 text-left transition-colors duration-300 ease-kinetic',
                      memberId === member.id ? 'bg-[var(--color-surface-raised)] text-raised-accent' : 'hover:bg-surface text-ink',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-3">
                      <span className="tabular flex h-7 w-7 items-center justify-center border border-hairline text-[9px] font-bold">
                        {initials(member.fullName)}
                      </span>
                      <span className="text-sm font-semibold">{member.fullName}</span>
                    </span>
                    <StatusBadge status={member.status} />
                  </button>
                ))
              )}
            </div>
            {selectedMember ? (
              <p className="mt-3 text-xs text-muted">
                Seleccionado: <span className="font-semibold text-ink">{selectedMember.fullName}</span> ·{' '}
                {selectedMember.membership?.planName ?? 'sin membresía'} · vence{' '}
                {selectedMember.membership?.endDate ? formatDateTime(selectedMember.membership.endDate) : '—'}
              </p>
            ) : null}
          </div>

          <div>
            <h2 className="mb-4 border-b border-hairline pb-3 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">
              02 · Plan
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.length === 0 ? (
                <p className="text-sm text-muted">
                  {loadingData ? 'Cargando planes…' : 'No hay planes activos. Configura uno en la sección Planes.'}
                </p>
              ) : (
                plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setPlanId(plan.id)}
                    className={[
                      'min-h-12 border px-4 py-3 text-left transition-all duration-300 ease-kinetic',
                      planId === plan.id
                        ? 'border-volt bg-[var(--color-surface-raised)]'
                        : 'border-hairline bg-surface hover:border-volt/40',
                    ].join(' ')}
                  >
                    <span className="block text-sm font-bold text-ink">{plan.name}</span>
                    <span className="tabular mt-1 block text-xs text-muted">
                      {plan.durationDays} días · {formatCurrency(plan.price)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="space-y-10">
          <div>
            <h2 className="mb-4 border-b border-hairline pb-3 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">
              03 · Importe y método
            </h2>
            <NumericInput value={amount} onChange={setAmount} currency label="Monto a cobrar" step={50} min={0} />
            <fieldset className="mt-7">
              <legend className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Método de pago
              </legend>
              <div className="grid grid-cols-3 gap-px bg-[var(--color-hairline)]">
                {METHODS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setMethod(item.value)}
                    aria-pressed={method === item.value}
                    className={[
                      'min-h-12 px-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-300 ease-kinetic',
                      method === item.value ? 'bg-volt text-canvas' : 'bg-surface text-muted hover:text-ink',
                    ].join(' ')}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="border-t border-hairline pt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Total</span>
              <span className="tabular font-display text-3xl font-extrabold tracking-[-0.04em] text-volt">
                {formatCurrency(amount)}
              </span>
            </div>
            <p className="tabular mt-3 text-[10px] uppercase tracking-[0.12em] text-muted">
              Llave de idempotencia · {idempotencyRef.current?.slice(0, 18) ?? '—'}…
            </p>
            <Button type="submit" fullWidth loading={submitting} className="mt-7" disabled={!idempotencyReady || !memberId || !planId || amount <= 0}>
              {submitting ? 'Procesando cargo' : 'Confirmar cobro'}
            </Button>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
              El botón se bloquea durante el envío. No cierres esta ventana hasta ver el comprobante.
            </p>
          </div>
        </section>
      </form>

      <section className="mt-16">
        <div className="mb-5 border-b border-hairline pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Actividad reciente</p>
          <h2 className="mt-2 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">Últimos cobros</h2>
        </div>
        {recent.length === 0 ? (
          <p className="py-10 text-sm text-muted">Todavía no hay cobros en este turno.</p>
        ) : (
          <ul>
            {recent.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-4 border-b border-hairline py-4">
                <span>
                  <span className="block text-sm text-ink">{payment.memberName}</span>
                  <span className="tabular block text-[11px] uppercase tracking-[0.1em] text-muted">
                    {payment.planName} · {formatDateTime(payment.createdAt)}
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  <StatusBadge status={payment.status} />
                  <span className="tabular text-sm font-bold">{formatCurrency(payment.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
