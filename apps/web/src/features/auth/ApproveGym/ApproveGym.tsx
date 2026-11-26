'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, getErrorMessage } from '@/lib/api-client'
import { Button } from '@/ui/primitives/Button'
import { isApiError, type GymVerification } from '@/types'

type State = 'checking' | 'success' | 'error' | 'idle'

/** Autorización de un alta recibida por correo por un administrador global. */
export function ApproveGym() {
  const params = useSearchParams()
  const token = params.get('token')
  const hasAttempted = useRef(false)
  const [state, setState] = useState<State>(token ? 'checking' : 'idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<GymVerification | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [loginRequired, setLoginRequired] = useState(false)

  const approve = useCallback(async (value: string) => {
    setState('checking')
    setMessage('')
    setLoginRequired(false)
    try {
      const verification = await api.gyms.approve(value)
      setResult(verification)
      setState('success')
      setMessage(verification.message || 'Gimnasio autorizado correctamente.')
    } catch (error) {
      setResult(null)
      setState('error')
      setLoginRequired(isApiError(error) && error.status === 401)
      setMessage(getErrorMessage(error))
    }
  }, [])

  useEffect(() => {
    if (!token || hasAttempted.current) return
    hasAttempted.current = true
    void approve(token)
  }, [token, retryCount, approve])

  return (
    <div className="w-full max-w-md">
      <p className="mb-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-volt">
        <span aria-hidden className="h-px w-6 bg-volt" />
        Autorización global
      </p>
      <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-[-0.03em] text-ink">
        Autorizar gimnasio
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Este enlace es de un solo uso y expira en 30 minutos. Confírmalo para dar de alta el gimnasio.
      </p>

      <div className="mt-8 space-y-5">
        {state === 'checking' ? (
          <div role="status" className="border-l-2 border-volt bg-surface px-4 py-4 text-sm text-ink">
            Autorizando el gimnasio…
          </div>
        ) : null}

        {state === 'success' && result ? (
          <div role="status" className="space-y-4 border-l-2 border-volt bg-surface px-4 py-5">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-volt">Gimnasio autorizado</p>
            <p className="text-sm leading-relaxed text-ink">{result.gym.name}</p>
            {result.gym.publicCode ? (
              <p className="tabular text-xs leading-relaxed text-muted">
                ID público: <span className="font-semibold text-ink">{result.gym.publicCode}</span>
              </p>
            ) : null}
            <p className="text-sm leading-relaxed text-muted">{message}</p>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center bg-volt px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-canvas"
            >
              Ir al inicio de sesión
            </Link>
          </div>
        ) : null}

        {state === 'error' ? (
          <div role="alert" className="space-y-4 border-l-2 border-ignition bg-surface px-4 py-5">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-ignition">No se pudo autorizar</p>
            <p className="text-sm leading-relaxed text-ink">{message}</p>
            {loginRequired && token ? (
              <Link
                href={`/login?next=${encodeURIComponent(`/approve-gym?token=${token}`)}`}
                className="inline-flex min-h-12 items-center justify-center bg-volt px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-canvas"
              >
                Iniciar sesión para autorizar
              </Link>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => {
                hasAttempted.current = false
                setRetryCount((count) => count + 1)
              }}
            >
              Reintentar autorización
            </Button>
          </div>
        ) : null}

        {state === 'idle' ? (
          <div role="status" className="border-l-2 border-volt bg-surface px-4 py-4 text-sm leading-relaxed text-ink">
            No recibimos un token de autorización. Abre el enlace completo que enviamos a tu correo.
          </div>
        ) : null}
      </div>
    </div>
  )
}
