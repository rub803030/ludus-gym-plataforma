'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, getErrorMessage } from '@/lib/api-client'
import { formatNumber, formatTime } from '@/lib/format'
import type { AccessEvent, MemberView, OccupancyView, QrResultStatus } from '@/types'
import { QrScanner } from '@/features/turnstile-live/QrScanner/QrScanner'
import { EmptyState } from '@/ui/layout/EmptyState'
import { PageHeader } from '@/ui/layout/PageHeader'
import { Button } from '@/ui/primitives/Button'
import { Skeleton } from '@/ui/primitives/Skeleton'
import { StatusBadge } from '@/ui/primitives/StatusBadge'

/** Codifica un payload JSON pegado a mano en el mismo base64url que usa la API. */
function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const RESULT_STYLE: Record<Exclude<QrResultStatus, 'idle'>, { title: string; border: string; text: string }> = {
  valid: { title: 'Acceso concedido', border: 'border-emerald', text: 'text-emerald' },
  invalid: { title: 'Código inválido', border: 'border-ignition', text: 'text-ignition' },
  expired: { title: 'Membresía vencida', border: 'border-ignition', text: 'text-ignition' },
  duplicate: { title: 'Entrada duplicada', border: 'border-muted', text: 'text-muted' },
}

export function OccupancyBoard() {
  const [occupancy, setOccupancy] = useState<OccupancyView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<AccessEvent[]>([])
  const [members, setMembers] = useState<MemberView[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)
  const [qrText, setQrText] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<{ status: QrResultStatus; message: string } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadOccupancy = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    try {
      const value = await api.access.occupancy()
      setOccupancy(value)
      setError(null)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      if (initial) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOccupancy(true)
    void api.members
      .list({ pageSize: 200 })
      .then((value) => setMembers(value.items))
      .catch(() => undefined)
    const interval = window.setInterval(() => void loadOccupancy(false), 15_000)
    return () => window.clearInterval(interval)
  }, [loadOccupancy])

  const filteredMembers = useMemo(() => {
    const needle = memberQuery.trim().toLowerCase()
    if (!needle) return members.slice(0, 6)
    return members
      .filter(
        (member) =>
          member.fullName.toLowerCase().includes(needle) || member.document.toLowerCase().includes(needle)
      )
      .slice(0, 6)
  }, [members, memberQuery])

  function registerEvent(status: QrResultStatus, message: string, memberName: string, detail: string) {
    setResult({ status, message })
    if (status === 'idle') return
    setEvents((current) =>
      [
        {
          id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          memberName,
          at: new Date().toISOString(),
          result: (status === 'valid' ? 'granted' : status === 'duplicate' ? 'duplicate' : 'denied') as AccessEvent['result'],
          detail,
        },
        ...current,
      ].slice(0, 12)
    )
    void loadOccupancy(false)
  }

  async function handleManualCheckin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedMemberId || checkingIn) return
    setCheckingIn(true)
    setActionError(null)
    try {
      const member = members.find((item) => item.id === selectedMemberId)
      const verification = await api.access.manualCheckin(selectedMemberId)
      registerEvent(
        verification.status,
        verification.message,
        member?.fullName ?? verification.event.memberName,
        verification.message
      )
    } catch (checkinError) {
      const message = getErrorMessage(checkinError)
      setActionError(message)
      registerEvent('expired', message, members.find((item) => item.id === selectedMemberId)?.fullName ?? 'Socio', message)
    } finally {
      setCheckingIn(false)
    }
  }

  function normalizeQrPayload(raw: string): string {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>
        return typeof record['token'] === 'string' ? record['token'].trim() : toBase64Url(JSON.stringify(record))
      }
    } catch {
      // El valor ya es un token base64url.
    }
    return raw.trim()
  }

  async function verifyToken(raw: string) {
    const token = normalizeQrPayload(raw)
    if (!token || verifying) return
    setVerifying(true)
    setActionError(null)
    try {
      const verification = await api.access.verifyQr({ token, deviceId: 'ludus-web-reader' })
      registerEvent(verification.status, verification.message, verification.event.memberName, verification.message)
    } catch (verifyError) {
      const message = getErrorMessage(verifyError)
      setActionError(message)
      registerEvent('invalid', message, 'QR no identificado', message)
    } finally {
      setVerifying(false)
    }
  }

  async function handleQrVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await verifyToken(qrText)
  }

  function handleScan(token: string) {
    setQrText(token)
    setScannerOpen(false)
    void verifyToken(token)
  }

  const percent = occupancy?.percent ?? 0

  return (
    <>
      <PageHeader
        eyebrow="Control de acceso"
        title="Torniquete en vivo"
        description="Lectura de aforo, validación de QR y registro manual. Cada intento queda trazado en el evento del turno."
        actions={
          <Button variant="ghost" onClick={() => void loadOccupancy(false)}>
            Actualizar lectura
          </Button>
        }
      />

      {error ? (
        <div role="alert" className="mb-8 border-l-2 border-ignition bg-surface px-5 py-4 text-sm text-muted">
          {error} La lectura se reintentará automáticamente cada 15 segundos.
        </div>
      ) : null}

      <section className="border border-hairline">
        <div className="grid gap-px bg-[var(--color-hairline)] md:grid-cols-3">
          <div className="bg-canvas p-7 md:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Aforo actual</p>
            {loading ? (
              <div className="mt-6 space-y-5">
                <Skeleton width="55%" height={54} />
                <Skeleton height={8} />
              </div>
            ) : (
              <>
                <p className="tabular mt-6 font-display text-6xl font-extrabold tracking-[-0.05em] text-ink">
                  {formatNumber(occupancy?.current ?? 0)}
                  <span className="ml-3 text-xl font-medium text-muted">/ {formatNumber(occupancy?.capacity ?? 0)}</span>
                </p>
                <div className="mt-8 h-2 w-full bg-[var(--color-surface-raised)]">
                  <div
                    className={`h-full transition-all duration-700 ease-kinetic ${percent >= 90 ? 'bg-ignition' : 'bg-volt'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="tabular mt-4 text-[11px] uppercase tracking-[0.14em] text-muted">
                  {percent}% de ocupación ·{' '}
                  {occupancy?.updatedAt ? `última lectura ${formatTime(occupancy.updatedAt)}` : 'esperando primera lectura'}
                </p>
              </>
            )}
          </div>
          <div className="bg-canvas p-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Capacidad disponible</p>
            <p className="tabular mt-6 font-display text-5xl font-extrabold tracking-[-0.05em] text-volt">
              {formatNumber(Math.max(0, (occupancy?.capacity ?? 0) - (occupancy?.current ?? 0)))}
            </p>
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted">Lugares libres en el piso</p>
          </div>
        </div>

        {occupancy?.zones && occupancy.zones.length > 0 ? (
          <div className="grid gap-px border-t border-hairline bg-[var(--color-hairline)] sm:grid-cols-2 lg:grid-cols-4">
            {occupancy.zones.map((zone) => (
              <div key={zone.name} className="bg-canvas px-6 py-5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{zone.name}</p>
                <p className="tabular mt-2 text-lg font-bold">
                  {zone.current}<span className="ml-1 text-xs font-normal text-muted">/ {zone.capacity}</span>
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="mb-5 border-b border-hairline pb-4 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">
            Verificación QR
          </h2>
          <form onSubmit={(event) => void handleQrVerify(event)}>
            <label htmlFor="qr-payload" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Contenido del código
            </label>
            <textarea
              id="qr-payload"
              value={qrText}
              onChange={(event) => setQrText(event.target.value)}
              rows={3}
              placeholder='Pega el token base64url del QR o el JSON del pase'
              className="w-full border border-hairline bg-surface p-4 font-mono text-xs leading-relaxed text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/50 focus:border-volt"
            />
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Escanea el pase con la cámara o pega el contenido manualmente. El acceso se valida al detectar el código.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" variant="ghost" onClick={() => setScannerOpen(true)} disabled={verifying}>
                Escanear QR
              </Button>
              <Button type="submit" loading={verifying} disabled={!qrText.trim()}>
                Validar código
              </Button>
            </div>
          </form>

          <h2 className="mb-5 mt-12 border-b border-hairline pb-4 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">
            Registro manual
          </h2>
          <form onSubmit={(event) => void handleManualCheckin(event)}>
            <label htmlFor="manual-member" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Buscar socio
            </label>
            <input
              id="manual-member"
              type="search"
              value={memberQuery}
              onChange={(event) => {
                setMemberQuery(event.target.value)
                setSelectedMemberId('')
              }}
              placeholder="Nombre o documento…"
              className="h-12 w-full border border-hairline bg-surface px-4 text-sm text-ink outline-none transition-colors duration-300 ease-kinetic placeholder:text-muted/60 focus:border-volt"
            />
            <div className="mt-2 max-h-52 overflow-y-auto border border-hairline">
              {filteredMembers.length === 0 ? (
                <p className="px-4 py-5 text-center text-sm text-muted">Sin socios coincidentes.</p>
              ) : (
                filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      setSelectedMemberId(member.id)
                      setMemberQuery(member.fullName)
                    }}
                    className={[
                      'flex min-h-12 w-full items-center justify-between border-b border-hairline px-4 text-left text-sm transition-colors duration-300 ease-kinetic',
                      selectedMemberId === member.id ? 'bg-[var(--color-surface-raised)] text-raised-accent' : 'text-ink hover:bg-surface',
                    ].join(' ')}
                  >
                    <span className="font-semibold">{member.fullName}</span>
                    <StatusBadge status={member.status} />
                  </button>
                ))
              )}
            </div>
            <div className="mt-4">
              <Button type="submit" variant="ghost" loading={checkingIn} disabled={!selectedMemberId}>
                Registrar entrada
              </Button>
            </div>
          </form>

          {actionError ? (
            <p role="alert" className="mt-6 border-l-2 border-ignition bg-surface px-4 py-3 text-sm text-ink">
              {actionError}
            </p>
          ) : null}

          {result && result.status !== 'idle' ? (
            <div
              role="status"
              className={`mt-6 border-l-2 ${RESULT_STYLE[result.status].border} bg-surface px-5 py-4`}
            >
              <p className={`text-xs font-bold uppercase tracking-[0.16em] ${RESULT_STYLE[result.status].text}`}>
                {RESULT_STYLE[result.status].title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{result.message}</p>
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="mb-5 border-b border-hairline pb-4 font-display text-lg font-extrabold uppercase tracking-[-0.03em]">
            Eventos del turno
          </h2>
          {events.length === 0 ? (
            <EmptyState
              eyebrow="Sin eventos"
              title="Aún no hay accesos"
              description="Las validaciones de QR y los registros manuales aparecerán aquí con su resultado."
            />
          ) : (
            <ul>
              {events.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-5 border-b border-hairline py-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{event.memberName}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{event.detail}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={event.result === 'granted' ? 'valid' : event.result === 'duplicate' ? 'duplicate' : 'invalid'} />
                    <p className="tabular mt-2 text-[10px] text-muted">{formatTime(event.at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <QrScanner
        open={scannerOpen}
        onDetected={handleScan}
        onClose={() => setScannerOpen(false)}
      />
    </>
  )
}
