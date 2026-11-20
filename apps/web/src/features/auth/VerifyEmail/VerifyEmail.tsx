'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { api, getErrorMessage } from '@/lib/api-client'
import { Button } from '@/ui/primitives/Button'
import { isApiError } from '@/types'

type State = 'checking' | 'success' | 'error' | 'idle'

export function VerifyEmail() {
  const params = useSearchParams()
  const token = params.get('token')
  const emailParam = params.get('email') ?? ''
  const reason = params.get('reason')
  const hasAttempted = useRef(false)
  const [state, setState] = useState<State>(token ? 'checking' : 'idle')
  const [message, setMessage] = useState(
    reason === 'unverified'
      ? 'Tu correo todavía no está verificado. Usa el enlace que te enviamos o solicita uno nuevo.'
      : ''
  )
  const [email, setEmail] = useState(emailParam)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [verifiedEmail, setVerifiedEmail] = useState('')

  const confirm = useCallback(async (value: string) => {
    setBusy(true)
    setMessage('')
    try {
      const result = await api.auth.verifyEmail(value)
      const record = result as { email?: string; platform?: string }
      setVerifiedEmail(record.email ?? '')
      setState('success')
      setMessage(
        record.platform === 'mobile'
          ? 'Correo confirmado. Ya puedes volver a la app e iniciar sesión.'
          : 'Correo confirmado. Ya puedes entrar a la consola.'
      )
    } catch (error) {
      setState('error')
      setMessage(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!token || hasAttempted.current) return
    hasAttempted.current = true
    void confirm(token)
  }, [token, confirm])

  async function handleResend() {
    const normalized = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setState('error')
      setMessage('Captura un correo electrónico válido para reenviar el enlace.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await api.auth.resendVerification(normalized, 'web')
      setSent(true)
      setState('idle')
      setMessage('Si la cuenta existe y aún no está verificada, enviamos un nuevo enlace. Revisa tu bandeja y spam.')
    } catch (error) {
      setState('error')
      setMessage(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = code.trim()
    if (!value) return
    void confirm(value)
  }

  return (
    <div className="w-full max-w-md">
      <p className="mb-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-volt">
        <span aria-hidden className="h-px w-6 bg-volt" />
        Verificación de identidad
      </p>
      <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-[-0.03em] text-ink">
        Confirma tu correo
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        La verificación es obligatoria para todo el equipo y los socios de Ludus GYM.
      </p>

      <div className="mt-8 space-y-5">
        {state === 'checking' ? (
          <div role="status" className="border-l-2 border-volt bg-surface px-4 py-3 text-sm text-ink">
            Validando el enlace de verificación…
          </div>
        ) : null}

        {state === 'success' ? (
          <div role="status" className="space-y-4 border-l-2 border-volt bg-surface px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-volt">Correo verificado</p>
            {verifiedEmail ? <p className="break-all text-sm text-ink">{verifiedEmail}</p> : null}
            <p className="text-sm leading-relaxed text-muted">{message}</p>
            <a
              href="/login"
              className="inline-flex min-h-12 items-center justify-center bg-volt px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-canvas"
            >
              Ir al inicio de sesión
            </a>
          </div>
        ) : null}

        {state !== 'success' && message ? (
          <div
            role={state === 'error' ? 'alert' : 'status'}
            className={`border-l-2 bg-surface px-4 py-3 text-sm leading-relaxed text-ink ${state === 'error' ? 'border-ignition' : 'border-volt'}`}
          >
            {message}
          </div>
        ) : null}

        {state !== 'success' ? (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div>
              <label htmlFor="verify-code" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                ¿El enlace no abre aquí? Pega el código del correo
              </label>
              <input
                id="verify-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="h-12 w-full border-b border-hairline bg-transparent text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/45 focus:border-volt"
                placeholder="Pega aquí el enlace o código"
              />
            </div>
            <Button type="submit" loading={busy} fullWidth disabled={!code.trim()}>
              Verificar código
            </Button>
          </form>
        ) : null}

        {state !== 'success' ? (
          <div className="space-y-3 border-t border-hairline pt-5">
            <label htmlFor="verify-email" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Reenviar enlace
            </label>
            <input
              id="verify-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setSent(false)
              }}
              className="h-12 w-full border-b border-hairline bg-transparent text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/45 focus:border-volt"
              placeholder="tu@correo.com"
            />
            <Button variant="ghost" loading={busy} onClick={handleResend}>
              {sent ? 'Reenviar de nuevo' : 'Enviar nuevo enlace'}
            </Button>
          </div>
        ) : null}

        <a href="/login" className="block text-[11px] uppercase tracking-[0.14em] text-muted/70 hover:text-volt">
          ← Volver al inicio de sesión
        </a>
      </div>
    </div>
  )
}
