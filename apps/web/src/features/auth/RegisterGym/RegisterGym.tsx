'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { api, getErrorMessage } from '@/lib/api-client'
import { Button } from '@/ui/primitives/Button'
import type { GymRegistration, VerificationIssue } from '@/types'

interface FormState {
  gymName: string
  slug: string
  ownerName: string
  email: string
  password: string
  contactEmail: string
  phone: string
  address: string
  city: string
  state: string
  postalCode: string
  legalRepresentative: string
  rfc: string
  website: string
  socialMedia: string
  description: string
  branchCount: string
  timezone: string
  capacity: string
  currency: 'MXN'
  openingHours: string
}

type FormErrors = Partial<Record<keyof FormState, string>> & { form?: string }

const EMPTY_FORM: FormState = {
  gymName: '',
  slug: '',
  ownerName: '',
  email: '',
  password: '',
  contactEmail: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  legalRepresentative: '',
  rfc: '',
  website: '',
  socialMedia: '',
  description: '',
  branchCount: '1',
  timezone: 'America/Mexico_City',
  capacity: '20',
  currency: 'MXN',
  openingHours: '',
}

const INPUT_CLASS =
  'h-12 w-full border-b border-hairline bg-transparent text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/45 focus:border-volt'

/** Los enlaces de desarrollo de la API apuntan a rutas relativas del flujo correcto. */
function developmentLink(issue: VerificationIssue, path: '/verify-gym' | '/approve-gym'): string | null {
  const token = issue.devToken?.trim()
  if (token) return `${path}?token=${encodeURIComponent(token)}`

  const devLink = issue.devLink?.trim()
  if (!devLink) return null
  try {
    const tokenFromLink = new URL(devLink, window.location.origin).searchParams.get('token')
    if (tokenFromLink) return `${path}?token=${encodeURIComponent(tokenFromLink)}`
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
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(form.email.trim()) || form.email.trim().length > 255) {
      next.email = 'Captura un correo electrónico válido.'
    }
    if (!emailPattern.test(form.contactEmail.trim()) || form.contactEmail.trim().length > 255) {
      next.contactEmail = 'Captura el correo de contacto del gimnasio.'
    }
    if (form.password.length < 12 || form.password.length > 128) {
      next.password = 'La contraseña debe tener entre 12 y 128 caracteres.'
    }
    if (form.phone.trim().length < 8 || form.phone.trim().length > 40) {
      next.phone = 'Captura un teléfono de contacto válido.'
    }
    if (form.address.trim().length < 5 || form.address.trim().length > 200) {
      next.address = 'La dirección debe tener entre 5 y 200 caracteres.'
    }
    if (form.city.trim().length < 2 || form.city.trim().length > 80) next.city = 'Indica la ciudad.'
    if (form.state.trim().length < 2 || form.state.trim().length > 80) next.state = 'Indica el estado.'
    if (form.postalCode.trim().length < 4 || form.postalCode.trim().length > 12) next.postalCode = 'Indica el código postal.'
    if (form.legalRepresentative.trim().length < 2 || form.legalRepresentative.trim().length > 120) {
      next.legalRepresentative = 'Indica el nombre del representante legal.'
    }
    const rfc = form.rfc.trim().toUpperCase()
    if (rfc.length < 12 || rfc.length > 13) next.rfc = 'El RFC debe tener entre 12 y 13 caracteres.'
    if (form.website && !/^https?:\/\//i.test(form.website.trim())) next.website = 'Usa una URL completa con https://.'
    if (form.socialMedia.length > 300) next.socialMedia = 'Las redes no pueden superar 300 caracteres.'
    if (form.description.length > 1000) next.description = 'La descripción no puede superar 1000 caracteres.'
    const branchCount = Number(form.branchCount)
    if (!Number.isInteger(branchCount) || branchCount < 1 || branchCount > 1000) {
      next.branchCount = 'El número de sucursales debe estar entre 1 y 1000.'
    }
    if (!form.timezone.trim() || form.timezone.trim().length > 64) {
      next.timezone = 'Indica una zona horaria válida (máximo 64 caracteres).'
    }
    const capacity = Number(form.capacity)
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) {
      next.capacity = 'La capacidad debe ser un número entero entre 1 y 100000.'
    }
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
        contactEmail: form.contactEmail.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        legalRepresentative: form.legalRepresentative.trim(),
        rfc: form.rfc.trim().toUpperCase(),
        ...(form.website.trim() ? { website: form.website.trim() } : {}),
        ...(form.socialMedia.trim() ? { socialMedia: form.socialMedia.trim() } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        branchCount: Number(form.branchCount),
        timezone: form.timezone.trim(),
        capacity: Number(form.capacity),
        currency: 'MXN',
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
    const verifyHref = developmentLink(registration.verification, '/verify-gym')
    const approvalHref = developmentLink(registration.approval, '/approve-gym')
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
            Enviamos la confirmación a <strong className="text-volt">{registration.verification.email}</strong> y el
            enlace de autorización a los administradores. Tu gimnasio se dará de alta cuando un administrador autorice
            el registro desde el correo.
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Gimnasio registrado: <span className="font-semibold text-ink">{registration.gym.name}</span>. Estado:{' '}
            <span className="font-semibold text-ink">pendiente de autorización</span>.
          </p>
          {verifyHref || approvalHref ? (
            <div className="border-t border-hairline pt-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                Accesos de desarrollo
              </p>
              <div className="flex flex-col gap-3">
                {verifyHref ? (
                  <a href={verifyHref} className="inline-flex min-h-12 items-center justify-center bg-volt px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-canvas">
                    Confirmar correo ahora
                  </a>
                ) : null}
                {approvalHref ? (
                  <a href={approvalHref} className="inline-flex min-h-12 items-center justify-center border border-hairline px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
                    Autorizar gimnasio ahora
                  </a>
                ) : null}
              </div>
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
        Captura los datos del gimnasio y del responsable. Confirmarás tu correo y un administrador autorizará el alta
        antes de que puedas entrar a la consola.
      </p>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="mt-9 space-y-7">
        <fieldset className="space-y-6">
          <legend className="text-[10px] font-semibold uppercase tracking-[0.18em] text-volt">Gimnasio</legend>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Nombre del gimnasio</span>
              <input value={form.gymName} onChange={(event) => update('gymName', event.target.value)} aria-invalid={Boolean(errors.gymName)} placeholder="GYM Norte" className={INPUT_CLASS} />
              {errors.gymName ? <span className="mt-2 block text-xs text-ignition">{errors.gymName}</span> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Identificador (opcional)</span>
              <input value={form.slug} onChange={(event) => update('slug', event.target.value)} aria-invalid={Boolean(errors.slug)} placeholder="gym-norte" className={INPUT_CLASS} />
              {errors.slug ? <span className="mt-2 block text-xs text-ignition">{errors.slug}</span> : null}
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Descripción</span>
            <input value={form.description} onChange={(event) => update('description', event.target.value)} aria-invalid={Boolean(errors.description)} placeholder="Equipos, servicios y enfoque" className={INPUT_CLASS} />
            {errors.description ? <span className="mt-2 block text-xs text-ignition">{errors.description}</span> : null}
          </label>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Sitio web (opcional)</span>
              <input value={form.website} onChange={(event) => update('website', event.target.value)} aria-invalid={Boolean(errors.website)} placeholder="https://..." className={INPUT_CLASS} />
              {errors.website ? <span className="mt-2 block text-xs text-ignition">{errors.website}</span> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Redes (opcional)</span>
              <input value={form.socialMedia} onChange={(event) => update('socialMedia', event.target.value)} aria-invalid={Boolean(errors.socialMedia)} placeholder="@gymnorte" className={INPUT_CLASS} />
              {errors.socialMedia ? <span className="mt-2 block text-xs text-ignition">{errors.socialMedia}</span> : null}
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-6">
          <legend className="text-[10px] font-semibold uppercase tracking-[0.18em] text-volt">Ubicación y contacto</legend>
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Dirección</span>
            <input value={form.address} onChange={(event) => update('address', event.target.value)} aria-invalid={Boolean(errors.address)} placeholder="Calle 1, colonia" className={INPUT_CLASS} />
            {errors.address ? <span className="mt-2 block text-xs text-ignition">{errors.address}</span> : null}
          </label>
          <div className="grid gap-6 sm:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Ciudad</span>
              <input value={form.city} onChange={(event) => update('city', event.target.value)} aria-invalid={Boolean(errors.city)} className={INPUT_CLASS} />
              {errors.city ? <span className="mt-2 block text-xs text-ignition">{errors.city}</span> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Estado</span>
              <input value={form.state} onChange={(event) => update('state', event.target.value)} aria-invalid={Boolean(errors.state)} className={INPUT_CLASS} />
              {errors.state ? <span className="mt-2 block text-xs text-ignition">{errors.state}</span> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Código postal</span>
              <input value={form.postalCode} onChange={(event) => update('postalCode', event.target.value)} aria-invalid={Boolean(errors.postalCode)} className={INPUT_CLASS} />
              {errors.postalCode ? <span className="mt-2 block text-xs text-ignition">{errors.postalCode}</span> : null}
            </label>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Teléfono</span>
              <input value={form.phone} onChange={(event) => update('phone', event.target.value)} aria-invalid={Boolean(errors.phone)} placeholder="5512345678" className={INPUT_CLASS} />
              {errors.phone ? <span className="mt-2 block text-xs text-ignition">{errors.phone}</span> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Correo del gimnasio</span>
              <input type="email" value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} aria-invalid={Boolean(errors.contactEmail)} placeholder="contacto@gymnorte.com" className={INPUT_CLASS} />
              {errors.contactEmail ? <span className="mt-2 block text-xs text-ignition">{errors.contactEmail}</span> : null}
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Horario de atención</span>
            <input value={form.openingHours} onChange={(event) => update('openingHours', event.target.value)} aria-invalid={Boolean(errors.openingHours)} placeholder="Lun–Vie 06:00–22:00" className={INPUT_CLASS} />
            {errors.openingHours ? <span className="mt-2 block text-xs text-ignition">{errors.openingHours}</span> : null}
          </label>
        </fieldset>

        <fieldset className="space-y-6">
          <legend className="text-[10px] font-semibold uppercase tracking-[0.18em] text-volt">Responsable</legend>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Nombre del propietario</span>
              <input value={form.ownerName} onChange={(event) => update('ownerName', event.target.value)} aria-invalid={Boolean(errors.ownerName)} placeholder="Ana López" className={INPUT_CLASS} />
              {errors.ownerName ? <span className="mt-2 block text-xs text-ignition">{errors.ownerName}</span> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Correo del propietario</span>
              <input type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} aria-invalid={Boolean(errors.email)} placeholder="ana@example.com" className={INPUT_CLASS} />
              {errors.email ? <span className="mt-2 block text-xs text-ignition">{errors.email}</span> : null}
            </label>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Representante legal</span>
              <input value={form.legalRepresentative} onChange={(event) => update('legalRepresentative', event.target.value)} aria-invalid={Boolean(errors.legalRepresentative)} className={INPUT_CLASS} />
              {errors.legalRepresentative ? <span className="mt-2 block text-xs text-ignition">{errors.legalRepresentative}</span> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">RFC</span>
              <input value={form.rfc} onChange={(event) => update('rfc', event.target.value.toUpperCase())} aria-invalid={Boolean(errors.rfc)} placeholder="LOPEZ900101ABC" className={INPUT_CLASS} />
              {errors.rfc ? <span className="mt-2 block text-xs text-ignition">{errors.rfc}</span> : null}
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Contraseña</span>
            <input type="password" autoComplete="new-password" value={form.password} onChange={(event) => update('password', event.target.value)} aria-invalid={Boolean(errors.password)} placeholder="Mínimo 12 caracteres" className={INPUT_CLASS} />
            {errors.password ? <span className="mt-2 block text-xs text-ignition">{errors.password}</span> : null}
          </label>
        </fieldset>

        <fieldset className="space-y-6">
          <legend className="text-[10px] font-semibold uppercase tracking-[0.18em] text-volt">Operación</legend>
          <div className="grid gap-6 sm:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Zona horaria</span>
              <input value={form.timezone} onChange={(event) => update('timezone', event.target.value)} aria-invalid={Boolean(errors.timezone)} className={INPUT_CLASS} />
              {errors.timezone ? <span className="mt-2 block text-xs text-ignition">{errors.timezone}</span> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Capacidad</span>
              <input type="number" min={1} max={100000} step={1} value={form.capacity} onChange={(event) => update('capacity', event.target.value)} aria-invalid={Boolean(errors.capacity)} className={INPUT_CLASS} />
              {errors.capacity ? <span className="mt-2 block text-xs text-ignition">{errors.capacity}</span> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Sucursales</span>
              <input type="number" min={1} max={1000} step={1} value={form.branchCount} onChange={(event) => update('branchCount', event.target.value)} aria-invalid={Boolean(errors.branchCount)} className={INPUT_CLASS} />
              {errors.branchCount ? <span className="mt-2 block text-xs text-ignition">{errors.branchCount}</span> : null}
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Moneda</span>
              <select value={form.currency} onChange={() => setForm((current) => ({ ...current, currency: 'MXN' }))} className={INPUT_CLASS}>
                <option value="MXN">MXN</option>
              </select>
            </label>
          </div>
        </fieldset>

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
