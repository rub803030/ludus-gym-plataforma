'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { api, getErrorMessage } from '@/lib/api-client'
import { Button } from '@/ui/primitives/Button'
import type { GymRegistration } from '@/types'

interface FormState {
  gymName: string
  slug: string
  ownerName: string
  email: string
  password: string
  timezone: string
  capacity: string
  currency: 'MXN'
  address: string
  phone: string
  openingHours: string
}

type FormErrors = Partial<Record<keyof FormState, string>> & { form?: string }

const EMPTY_FORM: FormState = {
  gymName: '',
  slug: '',
  ownerName: '',
  email: '',
  password: '',
  timezone: 'America/Mexico_City',
  capacity: '20',
  currency: 'MXN',
  address: '',
  phone: '',
  openingHours: '',
}

const INPUT_CLASS =
  'h-12 w-full border-b border-hairline bg-transparent text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/45 focus:border-volt'

/** El enlace de desarrollo de la API apunta a /verify-email; aquí se lleva al flujo del gimnasio. */
function developmentLink(registration: GymRegistration): string | null {
  const token = registration.verification.devToken?.trim()
  if (token) return `/verify-gym?token=${encodeURIComponent(token)}`

  const devLink = registration.verification.devLink?.trim()
  if (!devLink) return null
  try {
    const tokenFromLink = new URL(devLink, window.location.origin).searchParams.get('token')
    if (tokenFromLink) return `/verify-gym?token=${encodeURIComponent(tokenFromLink)}`
  } catch {
    /* Se muestra el enlace tal cual lo devolvió la API. */
  }
  return devLink
}

export function RegisterGym() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [registration, setRegistration] = useState<GymRegistration | null>(null)

  function update(key: Exclude<keyof FormState, 'currency'>, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
  }

  function validate(): FormErrors {
    const next: FormErrors = {}
    if (form.gymName.trim().length < 2 || form.gymName.trim().length > 120) {
      next.gymName = 'El nombre del gimnasio debe tener entre 2 y 120 caracteres.'
    }
    const slug = form.slug.trim()
    if (slug && (slug.length < 3 || slug.length > 48 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
      next.slug = 'Usa entre 3 y 48 caracteres: minúsculas, números y guiones; por ejemplo: gym-norte.'
    }
    if (form.ownerName.trim().length < 2 || form.ownerName.trim().length > 120) {
      next.ownerName = 'El nombre del propietario debe tener entre 2 y 120 caracteres.'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.email.trim().length > 255) {
      next.email = 'Captura un correo electrónico válido.'
    }
    if (form.password.length < 12 || form.password.length > 128) {
      next.password = 'La contraseña debe tener entre 12 y 128 caracteres.'
    }
    if (!form.timezone.trim() || form.timezone.trim().length > 64) {
      next.timezone = 'Indica una zona horaria válida (máximo 64 caracteres).'
    }
    const capacity = Number(form.capacity)
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) {
      next.capacity = 'La capacidad debe ser un número entero entre 1 y 100000.'
    }
    if (form.address.length > 200) next.address = 'La dirección no puede superar 200 caracteres.'
    if (form.phone.length > 40) next.phone = 'El teléfono no puede superar 40 caracteres.'
    if (form.openingHours.length > 200) next.openingHours = 'El horario no puede superar 200 caracteres.'
    return next
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    try {
      const result = await api.gyms.register({
        gymName: form.gymName.trim(),
        ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
        ownerName: form.ownerName.trim(),
        email: form.email.trim(),
        password: form.password,
        timezone: form.timezone.trim(),
        capacity: Number(form.capacity),
        currency: 'MXN',
        ...(form.address.trim() ? { address: form.address.trim() } : {}),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.openingHours.trim() ? { openingHours: form.openingHours.trim() } : {}),
      })
      setRegistration(result)
    } catch (error) {
      setErrors({ form: getErrorMessage(error) })
    } finally {
      setLoading(false)
    }
  }

  if (registration) {
    const email = registration.verification.email || registration.owner.email
    const verifyHref = developmentLink(registration)
    return (
      <div className="w-full max-w-md">
        <p className="mb-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-volt">
          <span aria-hidden className="h-px w-6 bg-volt" />
          Registro recibido
        </p>
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-[-0.03em] text-ink">
          Confirma tu gimnasio
        </h1>
        <div role="status" className="mt-8 space-y-4 border-l-2 border-volt bg-surface px-4 py-5">
          <p className="text-sm leading-relaxed text-ink">
            Enviamos el enlace de verificación a <strong className="text-volt">{email}</strong>. Sigue las
            instrucciones del correo para activar la cuenta del gimnasio.
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Gimnasio registrado: <span className="font-semibold text-ink">{registration.gym.name}</span>. Estado:{' '}
            <span className="font-semibold text-ink">pendiente de verificación</span>.
          </p>
          {verifyHref ? (
            <div className="border-t border-hairline pt-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                Verificación en desarrollo
              </p>
              <a
                href={verifyHref}
                className="inline-flex min-h-12 items-center justify-center bg-volt px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-canvas"
              >
                Verificar gimnasio ahora
              </a>
            </div>
          ) : null}
        </div>
        <Link
          href="/login"
          className="mt-8 block text-[11px] uppercase tracking-[0.14em] text-muted/70 hover:text-volt"
        >
          ← Ir al inicio de sesión
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg">
      <p className="mb-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-volt">
        <span aria-hidden className="h-px w-6 bg-volt" />
        Nuevo tenant
      </p>
      <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-[-0.03em] text-ink">
        Registra tu gimnasio
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Crea la cuenta del propietario y la ficha inicial. Recibirás un enlace para verificar el gimnasio antes de
        entrar a la consola.
      </p>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="mt-9 space-y-7">
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Nombre del gimnasio
            </span>
            <input
              value={form.gymName}
              onChange={(event) => update('gymName', event.target.value)}
              aria-invalid={Boolean(errors.gymName)}
              placeholder="GYM Norte"
              className={INPUT_CLASS}
            />
            {errors.gymName ? <span className="mt-2 block text-xs text-ignition">{errors.gymName}</span> : null}
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Identificador (opcional)
            </span>
            <input
              value={form.slug}
              onChange={(event) => update('slug', event.target.value)}
              aria-invalid={Boolean(errors.slug)}
              placeholder="gym-norte"
              className={INPUT_CLASS}
            />
            {errors.slug ? <span className="mt-2 block text-xs text-ignition">{errors.slug}</span> : null}
          </label>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Nombre del propietario
            </span>
            <input
              value={form.ownerName}
              onChange={(event) => update('ownerName', event.target.value)}
              aria-invalid={Boolean(errors.ownerName)}
              placeholder="Ana López"
              className={INPUT_CLASS}
            />
            {errors.ownerName ? <span className="mt-2 block text-xs text-ignition">{errors.ownerName}</span> : null}
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Correo del propietario
            </span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              aria-invalid={Boolean(errors.email)}
              placeholder="ana@example.com"
              className={INPUT_CLASS}
            />
            {errors.email ? <span className="mt-2 block text-xs text-ignition">{errors.email}</span> : null}
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Contraseña
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => update('password', event.target.value)}
            aria-invalid={Boolean(errors.password)}
            placeholder="Mínimo 12 caracteres"
            className={INPUT_CLASS}
          />
          {errors.password ? <span className="mt-2 block text-xs text-ignition">{errors.password}</span> : null}
        </label>

        <div className="grid gap-6 sm:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Zona horaria
            </span>
            <input
              value={form.timezone}
              onChange={(event) => update('timezone', event.target.value)}
              aria-invalid={Boolean(errors.timezone)}
              className={INPUT_CLASS}
            />
            {errors.timezone ? <span className="mt-2 block text-xs text-ignition">{errors.timezone}</span> : null}
          </label>
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
              aria-invalid={Boolean(errors.capacity)}
              className={INPUT_CLASS}
            />
            {errors.capacity ? <span className="mt-2 block text-xs text-ignition">{errors.capacity}</span> : null}
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Moneda
            </span>
            <select
              value={form.currency}
              onChange={() => setForm((current) => ({ ...current, currency: 'MXN' }))}
              className={INPUT_CLASS}
            >
              <option value="MXN">MXN</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Dirección</span>
          <input
            value={form.address}
            onChange={(event) => update('address', event.target.value)}
            aria-invalid={Boolean(errors.address)}
            placeholder="Calle 1, colonia, ciudad"
            className={INPUT_CLASS}
          />
          {errors.address ? <span className="mt-2 block text-xs text-ignition">{errors.address}</span> : null}
        </label>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Teléfono</span>
            <input
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
              aria-invalid={Boolean(errors.phone)}
              placeholder="5512345678"
              className={INPUT_CLASS}
            />
            {errors.phone ? <span className="mt-2 block text-xs text-ignition">{errors.phone}</span> : null}
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Horario</span>
            <input
              value={form.openingHours}
              onChange={(event) => update('openingHours', event.target.value)}
              aria-invalid={Boolean(errors.openingHours)}
              placeholder="Lun–Vie 06:00–22:00"
              className={INPUT_CLASS}
            />
            {errors.openingHours ? <span className="mt-2 block text-xs text-ignition">{errors.openingHours}</span> : null}
          </label>
        </div>

        {errors.form ? (
          <div role="alert" className="border-l-2 border-ignition bg-surface px-4 py-3 text-sm leading-relaxed text-ink">
            {errors.form}
          </div>
        ) : null}

        <Button type="submit" loading={loading} fullWidth>
          {loading ? 'Registrando gimnasio' : 'Crear gimnasio'}
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-8 block text-[11px] uppercase tracking-[0.14em] text-muted/70 hover:text-volt"
      >
        ← Volver al inicio de sesión
      </Link>
    </div>
  )
}
