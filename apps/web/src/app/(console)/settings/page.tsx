'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { api, clearSession, getErrorMessage, hydrateSession } from '@/lib/api-client'
import { roleLabel } from '@/lib/format'
import { useSession } from '@/lib/use-session'
import { PageHeader } from '@/ui/layout/PageHeader'
import { Button } from '@/ui/primitives/Button'
import { ThemeToggle } from '@/ui/primitives/ThemeToggle'
import type { GymProfile, GymProfileInput } from '@/types'

interface ProfileForm {
  name: string
  address: string
  phone: string
  openingHours: string
  logoUrl: string
  timezone: string
  capacity: string
  currency: 'MXN'
}

const EMPTY_FORM: ProfileForm = {
  name: '',
  address: '',
  phone: '',
  openingHours: '',
  logoUrl: '',
  timezone: 'America/Mexico_City',
  capacity: '20',
  currency: 'MXN',
}

const INPUT_CLASS =
  'h-12 w-full border border-hairline bg-canvas px-4 text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/50 focus:border-volt'

function toForm(gym: GymProfile): ProfileForm {
  return {
    name: gym.name,
    address: gym.address ?? '',
    phone: gym.phone ?? '',
    openingHours: gym.openingHours ?? '',
    logoUrl: gym.logoUrl ?? '',
    timezone: gym.timezone,
    capacity: String(gym.capacity),
    currency: 'MXN',
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const session = useSession()
  const [loggingOut, setLoggingOut] = useState(false)
  const [gym, setGym] = useState<GymProfile | null>(null)
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM)
  const [loadingGym, setLoadingGym] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadGym = useCallback(async () => {
    setLoadingGym(true)
    setLoadError(null)
    try {
      const profile = await api.gyms.me()
      setGym(profile)
      setForm(toForm(profile))
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setLoadingGym(false)
    }
  }, [])

  useEffect(() => {
    hydrateSession()
    void loadGym()
  }, [loadGym])

  function update(key: Exclude<keyof ProfileForm, 'currency'>, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setSaveError(null)
    setNotice(null)
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !gym) return
    if (form.name.trim().length < 2 || form.name.trim().length > 120) {
      setSaveError('El nombre del gimnasio debe tener entre 2 y 120 caracteres.')
      return
    }
    if (form.address.trim().length > 200 || form.phone.trim().length > 40 || form.openingHours.trim().length > 200) {
      setSaveError('Revisa la longitud de la dirección (200), el teléfono (40) o el horario (200).')
      return
    }
    if (form.timezone.trim().length > 64) {
      setSaveError('La zona horaria no puede superar 64 caracteres.')
      return
    }
    const capacity = Number(form.capacity)
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) {
      setSaveError('La capacidad debe ser un número entero entre 1 y 100000.')
      return
    }
    const logoUrl = form.logoUrl.trim()
    if (logoUrl) {
      try {
        new URL(logoUrl)
        if (logoUrl.length > 500) throw new Error('URL demasiado larga')
      } catch {
        setSaveError('Escribe una URL válida de hasta 500 caracteres o deja el campo vacío.')
        return
      }
    }
    setSaving(true)
    setSaveError(null)
    setNotice(null)
    const payload: GymProfileInput = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      openingHours: form.openingHours.trim() || null,
      logoUrl: logoUrl || null,
      timezone: form.timezone.trim(),
      capacity,
      currency: 'MXN',
    }
    try {
      const updated = await api.gyms.update(payload)
      setGym(updated)
      setForm(toForm(updated))
      setNotice('Datos del gimnasio guardados correctamente.')
    } catch (error) {
      setSaveError(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await api.auth.logout()
    } catch {
      /* Se limpia el estado local aunque la API no esté disponible. */
    }
    clearSession()
    router.replace('/login')
    router.refresh()
  }

  const principal = session?.principal
  const canEdit = principal?.role === 'OWNER'
  const enrollmentValue = gym?.enrollmentQrToken || gym?.publicCode || 'LUDUS-GYM'

  return (
    <>
      <PageHeader
        eyebrow="Preferencias"
        title="Configuración"
        description="Ficha del gimnasio, apariencia de la consola y detalle de la sesión operativa actual."
      />

      <section className="border border-hairline bg-surface p-7 md:p-9">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-volt">Identidad del tenant</p>
        <h2 className="mt-3 font-display text-xl font-extrabold uppercase tracking-[-0.03em]">Ficha del gimnasio</h2>

        {loadingGym ? (
          <div className="mt-8 h-64 animate-pulse border border-hairline bg-canvas" />
        ) : loadError || !gym ? (
          <div role="alert" className="mt-8 border-l-2 border-ignition bg-canvas px-5 py-4 text-sm text-ink">
            {loadError ?? 'No se pudo cargar la ficha del gimnasio.'}
            <div className="mt-4">
              <Button variant="ghost" onClick={() => void loadGym()}>
                Reintentar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {notice ? (
              <p role="status" className="mt-6 border-l-2 border-emerald bg-canvas px-5 py-3 text-sm text-ink">
                {notice}
              </p>
            ) : null}
            {saveError ? (
              <p role="alert" className="mt-6 border-l-2 border-ignition bg-canvas px-5 py-3 text-sm text-ink">
                {saveError}
              </p>
            ) : null}

            <div className="mt-8 grid gap-10 lg:grid-cols-[240px_1fr]">
              <div className="flex flex-col items-center border border-hairline bg-white p-5 text-center">
                <QRCodeCanvas
                  value={enrollmentValue}
                  size={168}
                  level="M"
                  marginSize={2}
                  bgColor="#ffffff"
                  fgColor="#0b0c0e"
                  title={`QR de inscripción de ${gym.name}`}
                  className="h-auto max-w-full"
                />
                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b0c0e]">
                  Muestra este QR para que nuevos socios se vinculen
                </p>
                <div className="mt-5 w-full border-t border-[#d4d4d4] pt-4 text-left">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#555555]">ID público</p>
                  <p className="tabular mt-1 break-all text-sm font-bold text-[#0b0c0e]">
                    {gym.publicCode || 'Pendiente de verificación'}
                  </p>
                </div>
              </div>

              <form onSubmit={(event) => void handleSave(event)} className="space-y-6">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Nombre del gimnasio
                  </span>
                  <input
                    value={form.name}
                    onChange={(event) => update('name', event.target.value)}
                    disabled={!canEdit || saving}
                    className={INPUT_CLASS}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Dirección
                  </span>
                  <input
                    value={form.address}
                    onChange={(event) => update('address', event.target.value)}
                    disabled={!canEdit || saving}
                    className={INPUT_CLASS}
                  />
                </label>

                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Teléfono
                    </span>
                    <input
                      value={form.phone}
                      onChange={(event) => update('phone', event.target.value)}
                      disabled={!canEdit || saving}
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Zona horaria
                    </span>
                    <input
                      value={form.timezone}
                      onChange={(event) => update('timezone', event.target.value)}
                      disabled={!canEdit || saving}
                      className={INPUT_CLASS}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Horario de atención
                  </span>
                  <input
                    value={form.openingHours}
                    onChange={(event) => update('openingHours', event.target.value)}
                    disabled={!canEdit || saving}
                    placeholder="Lun–Vie 06:00–22:00"
                    className={INPUT_CLASS}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                    URL del logotipo
                  </span>
                  <input
                    type="url"
                    value={form.logoUrl}
                    onChange={(event) => update('logoUrl', event.target.value)}
                    disabled={!canEdit || saving}
                    placeholder="https://ejemplo.com/logo.png"
                    className={INPUT_CLASS}
                  />
                </label>

                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Capacidad
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      step={1}
                      value={form.capacity}
                      onChange={(event) => update('capacity', event.target.value)}
                      disabled={!canEdit || saving}
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Moneda
                    </span>
                    <select
                      value={form.currency}
                      onChange={() => setForm((current) => ({ ...current, currency: 'MXN' }))}
                      disabled={!canEdit || saving}
                      className={INPUT_CLASS}
                    >
                      <option value="MXN">MXN</option>
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-4 border-t border-hairline pt-5">
                  <Button type="submit" loading={saving} disabled={!canEdit}>
                    Guardar cambios
                  </Button>
                  {canEdit ? null : (
                    <p className="text-xs leading-relaxed text-muted">
                      Solo el propietario puede editar la ficha del gimnasio.
                    </p>
                  )}
                </div>
              </form>
            </div>
          </>
        )}
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
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
              <dd className="mt-2 text-sm text-ink">{principal?.activeGymId ?? principal?.gymId ?? '—'}</dd>
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
