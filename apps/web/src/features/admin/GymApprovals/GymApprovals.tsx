'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, getErrorMessage } from '@/lib/api-client'
import { Button } from '@/ui/primitives/Button'
import type { PendingGym } from '@/types'

/** Cola global de gimnasios pendientes de autorización. */
export function GymApprovals() {
  const [gyms, setGyms] = useState<PendingGym[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setGyms(await api.admin.pendingGyms())
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function sendApproval(gym: PendingGym) {
    setSending(gym.id)
    setError('')
    try {
      await api.admin.sendApproval(gym.id)
      setSent((current) => ({
        ...current,
        [gym.id]: `Enlace de un solo uso enviado a ${gym.contactEmail || 'los administradores'}.`,
      }))
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-7 py-12 md:px-12">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-volt">Plataforma</p>
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-[-0.03em] text-ink">
        Autorizar gimnasios
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Los gimnasios registrados desde la web o las apps quedan pendientes. Envía el enlace de autorización por correo;
        el enlace expira en 30 minutos y solo puede usarse una vez.
      </p>

      {error ? (
        <div role="alert" className="mt-8 border-l-2 border-ignition bg-surface px-4 py-3 text-sm text-ink">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div role="status" className="mt-8 border-l-2 border-volt bg-surface px-4 py-4 text-sm text-muted">
          Cargando solicitudes…
        </div>
      ) : null}

      {!loading && gyms.length === 0 ? (
        <div role="status" className="mt-8 border-l-2 border-volt bg-surface px-4 py-4 text-sm text-ink">
          No hay gimnasios pendientes de autorización.
        </div>
      ) : null}

      <ul className="mt-8 space-y-5">
        {gyms.map((gym) => (
          <li key={gym.id} className="border border-hairline bg-surface px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold uppercase tracking-[-0.02em] text-ink">{gym.name}</h2>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">{gym.slug}</p>
              </div>
              <Button
                variant="ghost"
                loading={sending === gym.id}
                onClick={() => void sendApproval(gym)}
              >
                {sending === gym.id ? 'Enviando' : 'Enviar autorización'}
              </Button>
            </div>
            <dl className="mt-5 grid gap-3 text-xs leading-relaxed text-muted sm:grid-cols-2">
              <div><dt className="font-semibold text-ink">Ubicación</dt><dd>{[gym.address, gym.city, gym.state, gym.postalCode].filter(Boolean).join(', ')}</dd></div>
              <div><dt className="font-semibold text-ink">Contacto</dt><dd>{[gym.contactEmail, gym.phone].filter(Boolean).join(' · ')}</dd></div>
              <div><dt className="font-semibold text-ink">Representante</dt><dd>{[gym.legalRepresentative, gym.rfc].filter(Boolean).join(' · ')}</dd></div>
              <div><dt className="font-semibold text-ink">Sucursales</dt><dd>{gym.branchCount}</dd></div>
              {gym.openingHours ? <div><dt className="font-semibold text-ink">Horario</dt><dd>{gym.openingHours}</dd></div> : null}
              {gym.website ? <div><dt className="font-semibold text-ink">Sitio web</dt><dd>{gym.website}</dd></div> : null}
              {gym.socialMedia ? <div><dt className="font-semibold text-ink">Redes</dt><dd>{gym.socialMedia}</dd></div> : null}
              {gym.description ? <div className="sm:col-span-2"><dt className="font-semibold text-ink">Descripción</dt><dd>{gym.description}</dd></div> : null}
            </dl>
            {sent[gym.id] ? (
              <p role="status" className="mt-4 border-l-2 border-volt px-3 py-2 text-xs text-ink">{sent[gym.id]}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
