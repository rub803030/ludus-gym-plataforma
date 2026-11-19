'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, getErrorMessage, hydrateSession } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/format'
import { useSession } from '@/lib/use-session'
import { PLAN_FLAGS, type PlanFlag, type PlanView } from '@/types'
import { EmptyState } from '@/ui/layout/EmptyState'
import { PageHeader } from '@/ui/layout/PageHeader'
import { Button } from '@/ui/primitives/Button'
import { ConfirmModal } from '@/ui/primitives/ConfirmModal'
import { NumericInput } from '@/ui/primitives/NumericInput'
import { StatusBadge } from '@/ui/primitives/StatusBadge'

interface PlanForm {
  name: string
  durationDays: number
  price: number
  description: string
  flags: Array<PlanFlag['key']>
  active: boolean
}

const EMPTY_FORM: PlanForm = {
  name: '',
  durationDays: 30,
  price: 0,
  description: '',
  flags: ['gym_access'],
  active: true,
}

export function PlanEditor() {
  const session = useSession()
  const [hydrated, setHydrated] = useState(false)
  const [plans, setPlans] = useState<PlanView[]>([])
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlanView | null>(null)

  useEffect(() => {
    hydrateSession()
    setHydrated(true)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.plans.list()
      setPlans(result.items)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.principal.role === 'OWNER') void load()
  }, [session?.principal.role, load])

  function toggleFlag(key: PlanFlag['key']) {
    setForm((current) => ({
      ...current,
      flags: current.flags.includes(key)
        ? current.flags.filter((flag) => flag !== key)
        : [...current.flags, key],
    }))
  }

  function startEdit(plan: PlanView) {
    setEditingId(plan.id)
    setForm({
      name: plan.name,
      durationDays: plan.durationDays,
      price: plan.price,
      description: plan.description,
      flags: [...plan.flags],
      active: plan.active,
    })
    setNotice(null)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (saving) return
    if (!form.name.trim() || form.price <= 0 || form.durationDays <= 0) {
      setError('Nombre, duración y precio son obligatorios para publicar un plan.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        durationDays: Math.round(form.durationDays),
        price: Math.round(form.price),
        description: form.description.trim(),
        flags: form.flags,
        active: form.active,
        currency: 'MXN',
      }
      if (editingId) await api.plans.update(editingId, payload)
      else await api.plans.create(payload)
      setNotice(editingId ? 'Plan actualizado correctamente.' : 'Plan creado y disponible para cobro.')
      resetForm()
      await load()
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || saving) return
    setSaving(true)
    try {
      await api.plans.remove(deleteTarget.id)
      setPlans((current) => current.filter((plan) => plan.id !== deleteTarget.id))
      if (editingId === deleteTarget.id) resetForm()
      setNotice('Plan eliminado del catálogo.')
      setDeleteTarget(null)
    } catch (deleteError) {
      setError(getErrorMessage(deleteError))
      setDeleteTarget(null)
    } finally {
      setSaving(false)
    }
  }

  if (!hydrated || !session) {
    return (
      <>
        <PageHeader
          eyebrow="Catálogo comercial"
          title="Planes y precios"
          description="Verificando permisos para editar el catálogo."
        />
        <div className="h-64 animate-pulse border border-hairline bg-surface" />
      </>
    )
  }

  if (session.principal.role !== 'OWNER') {
    return (
      <>
        <PageHeader
          eyebrow="Catálogo comercial"
          title="Planes y precios"
          description="La edición del catálogo comercial está reservada al propietario."
        />
        <EmptyState
          eyebrow="Acceso restringido"
          title="Solo OWNER"
          description="Tu perfil puede consultar planes, pero no crear, editar ni eliminarlos. Solicita permisos a un OWNER."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Catálogo comercial"
        title="Planes y precios"
        description="Define duración, precio y beneficios. Los cambios se reflejan de inmediato en el punto de venta."
        actions={
          <Button variant="ghost" onClick={() => void load()} loading={loading}>
            Actualizar
          </Button>
        }
      />

      {notice ? <p role="status" className="mb-6 border-l-2 border-emerald bg-surface px-5 py-3 text-sm">{notice}</p> : null}
      {error ? (
        <div role="alert" className="mb-6 border-l-2 border-ignition bg-surface px-5 py-4 text-sm text-muted">
          {error}
        </div>
      ) : null}

      <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr]">
        <section>
          <h2 className="mb-5 border-b border-hairline pb-4 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">
            Catálogo activo
          </h2>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse border border-hairline bg-surface" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <EmptyState
              eyebrow="Catálogo vacío"
              title="Sin planes publicados"
              description="Crea el primer plan para poder registrar cobros desde la caja."
            />
          ) : (
            <ul>
              {plans.map((plan) => (
                <li key={plan.id} className="border-b border-hairline py-5">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-display text-base font-extrabold uppercase tracking-[-0.02em]">{plan.name}</p>
                        <StatusBadge status={plan.active ? 'active' : 'inactive'} />
                      </div>
                      <p className="tabular mt-2 text-xs text-muted">
                        {formatCurrency(plan.price)} · {plan.durationDays} días
                      </p>
                      {plan.description ? <p className="mt-2 text-xs leading-relaxed text-muted">{plan.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button variant="ghost" className="min-h-12 px-3" onClick={() => startEdit(plan)}>
                        Editar
                      </Button>
                      <Button variant="ghost" className="min-h-12 px-3" onClick={() => setDeleteTarget(plan)}>
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-hairline bg-surface p-7 md:p-9">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-volt">
            {editingId ? 'Editando plan' : 'Nuevo plan'}
          </p>
          <h2 className="mt-3 font-display text-xl font-extrabold uppercase tracking-[-0.03em]">
            {editingId ? 'Actualizar condiciones' : 'Publicar condición'}
          </h2>

          <div className="mt-8 space-y-7">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Nombre</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Mensual ilimitado"
                className="h-12 w-full border border-hairline bg-canvas px-4 text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/50 focus:border-volt"
              />
            </label>

            <div className="grid gap-6 sm:grid-cols-2">
              <NumericInput
                label="Duración"
                value={form.durationDays}
                onChange={(value) => setForm((current) => ({ ...current, durationDays: value }))}
                min={1}
                max={3650}
                suffix="días"
              />
              <NumericInput
                label="Precio"
                value={form.price}
                onChange={(value) => setForm((current) => ({ ...current, price: value }))}
                currency
                min={0}
                step={50}
              />
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Descripción</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                placeholder="Beneficios principales del plan"
                className="w-full border border-hairline bg-canvas p-4 text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/50 focus:border-volt"
              />
            </label>

            <fieldset>
              <legend className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Beneficios</legend>
              <div className="grid gap-px bg-[var(--color-hairline)] sm:grid-cols-2">
                {PLAN_FLAGS.map((flag) => {
                  const checked = form.flags.includes(flag.key)
                  return (
                    <label
                      key={flag.key}
                      className="flex min-h-12 cursor-pointer items-center gap-3 bg-surface px-4 text-sm text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFlag(flag.key)}
                        className="h-4 w-4 accent-volt"
                      />
                      {flag.label}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <label className="flex min-h-12 cursor-pointer items-center justify-between border-t border-hairline pt-5 text-sm">
              <span>
                <span className="block font-semibold">Plan visible en caja</span>
                <span className="mt-1 block text-xs text-muted">Los planes inactivos no se pueden cobrar.</span>
              </span>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                className="h-5 w-5 accent-volt"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => void handleSave()} loading={saving}>
                {editingId ? 'Guardar cambios' : 'Crear plan'}
              </Button>
              <Button variant="ghost" onClick={resetForm} disabled={saving}>
                Limpiar
              </Button>
            </div>
            {plans.length > 0 ? (
              <p className="tabular text-[10px] uppercase tracking-[0.12em] text-muted">
                Última actualización del catálogo · {formatDate(plans[0]?.createdAt)}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Eliminar plan"
        description={`¿Eliminar "${deleteTarget?.name ?? ''}" del catálogo? Los socios con este plan conservarán su historial de pagos.`}
        confirmLabel="Eliminar plan"
        loading={saving}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
