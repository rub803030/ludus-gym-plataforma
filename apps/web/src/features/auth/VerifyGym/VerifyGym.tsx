'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, getErrorMessage } from '@/lib/api-client'
import { Button } from '@/ui/primitives/Button'
import type { GymVerification } from '@/types'

type State = 'checking' | 'success' | 'error' | 'idle'

export function VerifyGym() {
  const params = useSearchParams()
  const token = params.get('token')
  const hasAttempted = useRef(false)
  const [state, setState] = useState<State>(token ? 'checking' : 'idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<GymVerification | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const verify = useCallback(async (value: string) => {
    setState('checking')
    setMessage('')
    try {
      const verification = await api.gyms.verify(value)
      setResult(verification)
      setState('success')
      setMessage(verification.message || 'Correo confirmado. El gimnasio queda a la espera de la autorización de un administrador.')
    } catch (error) {
      setResult(null)
      setState('error')
      setMessage(getErrorMessage(error))
    }
  }, [])

  useEffect(() => {
    if (!token || hasAttempted.current) return
    hasAttempted.current = true
    void verify(token)
  }, [token, retryCount, verify])

  return (
    <div className="w-full max-w-md">
      <p className="mb-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-volt">
        <span aria-hidden className="h-px w-6 bg-volt" />
        Alta de gimnasio
      </p>
      <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-[-0.03em] text-ink">
        Verificar gimnasio
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Confirmamos el correo del propietario. El alta se completa cuando un administrador autoriza el gimnasio desde
        el enlace recibido por correo.
      </p>

      <div className="mt-8 space-y-5">
        {state === 'checking' ? (
          <div role="status" className="border-l-2 border-volt bg-surface px-4 py-4 text-sm text-ink">
            Verificando el enlace…
          </div>
        ) : null}

        {state === 'success' && result ? (
          <div role="status" className="space-y-4 border-l-2 border-volt bg-surface px-4 py-5">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-volt">
              {result.gym.status === 'ACTIVE' ? 'Gimnasio activo' : 'Correo del propietario confirmado'}
            </p>
            <p className="text-sm leading-relaxed text-ink">{result.gym.name}</p>
            <p className="text-sm leading-relaxed text-muted">
              {result.gym.status === 'PENDING_VERIFICATION'
                ? 'La verificación del correo está completa. El gimnasio todavía espera la autorización de un administrador y aún no está activo.'
                : result.gym.status === 'ACTIVE'
                  ? 'La cuenta del propietario y el gimnasio están activos.'
                  : 'El correo está confirmado, pero el gimnasio se encuentra suspendido.'}
            </p>
            {result.gym.status === 'ACTIVE' && result.gym.publicCode ? (
              <p className="tabular text-xs leading-relaxed text-muted">
                Código público: <span className="font-semibold text-ink">{result.gym.publicCode}</span>
              </p>
            ) : null}
            {message ? <p className="text-xs leading-relaxed text-muted">{message}</p> : null}
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
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-ignition">No se pudo verificar</p>
            <p className="text-sm leading-relaxed text-ink">{message}</p>
            <Button
              variant="ghost"
              onClick={() => {
                hasAttempted.current = false
                setRetryCount((count) => count + 1)
              }}
            >
              Reintentar verificación
            </Button>
          </div>
        ) : null}

        {state === 'idle' ? (
          <div role="status" className="border-l-2 border-volt bg-surface px-4 py-4 text-sm leading-relaxed text-ink">
            No recibimos un token de verificación. Abre el enlace completo que enviamos a tu correo.
          </div>
        ) : null}

        {state !== 'success' ? (
          <Link href="/login" className="block text-[11px] uppercase tracking-[0.14em] text-muted/70 hover:text-volt">
            ← Ir al inicio de sesión
          </Link>
        ) : null}
      </div>
    </div>
  )
}
