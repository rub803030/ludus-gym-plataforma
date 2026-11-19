'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  api,
  getCsrfFromLogin,
  getErrorMessage,
  getLoginRole,
  getPrincipalFromLogin,
  setSession,
} from '@/lib/api-client'
import { Button } from '@/ui/primitives/Button'

interface FieldErrors {
  email?: string
  password?: string
  form?: string
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [memberRejected, setMemberRejected] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMemberRejected(false)
    const nextErrors: FieldErrors = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Captura un correo electrónico válido.'
    }
    if (password.length < 8) {
      nextErrors.password = 'La contraseña debe tener al menos 8 caracteres.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    try {
      const raw = await api.auth.login(email.trim(), password)
      if (getLoginRole(raw) === 'MEMBER') {
        setMemberRejected(true)
        return
      }
      const principal = getPrincipalFromLogin(raw)
      if (!principal) {
        setErrors({ form: 'La cuenta respondió sin un perfil válido. Solicita acceso a un administrador.' })
        return
      }
      setSession({ principal, csrfToken: getCsrfFromLogin(raw) })
      router.replace('/dashboard')
      router.refresh()
    } catch (error) {
      setErrors({ form: getErrorMessage(error) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <p className="mb-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-volt">
        <span aria-hidden className="h-px w-6 bg-volt" />
        Acceso restringido
      </p>
      <h2 className="font-display text-3xl font-extrabold uppercase leading-none tracking-[-0.03em] text-ink">
        Iniciar operación
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Solo equipo de Ludus GYM. Los socios ingresan desde la app.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-10 space-y-7">
        <div>
          <label htmlFor="email" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Correo de trabajo
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (errors.email) setErrors((current) => ({ ...current, email: undefined }))
            }}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            placeholder="operacion@ludusgym.mx"
            className="h-12 w-full border-b border-hairline bg-transparent text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/45 focus:border-volt"
          />
          {errors.email ? (
            <p id="email-error" role="alert" className="mt-2 text-xs text-ignition">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              if (errors.password) setErrors((current) => ({ ...current, password: undefined }))
            }}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            placeholder="Mínimo 8 caracteres"
            className="h-12 w-full border-b border-hairline bg-transparent text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/45 focus:border-volt"
          />
          {errors.password ? (
            <p id="password-error" role="alert" className="mt-2 text-xs text-ignition">
              {errors.password}
            </p>
          ) : null}
        </div>

        {memberRejected ? (
          <div role="alert" className="border-l-2 border-ignition bg-surface px-4 py-3 text-sm leading-relaxed text-ink">
            Esta credencial pertenece a un socio. El acceso web está reservado al equipo de operación; los socios
            ingresan desde la app móvil.
          </div>
        ) : null}

        {errors.form ? (
          <div role="alert" className="border-l-2 border-ignition bg-surface px-4 py-3 text-sm leading-relaxed text-ink">
            {errors.form}
          </div>
        ) : null}

        <Button type="submit" loading={loading} fullWidth>
          {loading ? 'Validando identidad' : 'Entrar a la consola'}
          {!loading ? <span aria-hidden>→</span> : null}
        </Button>
      </form>

      <p className="mt-8 text-[11px] uppercase tracking-[0.14em] text-muted/70">
        Sesión auditada · Dispositivo registrado
      </p>
    </div>
  )
}
