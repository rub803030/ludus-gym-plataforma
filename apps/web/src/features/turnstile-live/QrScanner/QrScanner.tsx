'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { Button } from '@/ui/primitives/Button'

export interface QrScannerProps {
  open: boolean
  onDetected: (token: string) => void
  onClose: () => void
}

type ScannerState = 'starting' | 'scanning' | 'error'

function scannerError(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || /permission|denied/i.test(message)) {
    return 'Permiso de cámara denegado. Habilítalo en tu navegador y vuelve a intentarlo.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || /no.*device|not found/i.test(message)) {
    return 'No se encontró ninguna cámara disponible en este dispositivo.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || /could not start|in use/i.test(message)) {
    return 'La cámara está ocupada por otra aplicación. Ciérrala y vuelve a intentarlo.'
  }
  if (!window.isSecureContext) {
    return 'La cámara requiere una conexión segura (HTTPS) o localhost.'
  }
  return 'No se pudo iniciar la cámara. Revisa los permisos y vuelve a intentarlo.'
}

/** Lector de QR con cámara. Mantiene el pegado manual como respaldo en /access. */
export function QrScanner({ open, onDetected, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const detectedRef = useRef(false)
  const cancelledRef = useRef(false)
  const onDetectedRef = useRef(onDetected)
  const onCloseRef = useRef(onClose)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  onDetectedRef.current = onDetected
  onCloseRef.current = onClose

  const [state, setState] = useState<ScannerState>('starting')
  const [message, setMessage] = useState('Preparando la cámara…')
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')

  const stop = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
  }, [])

  const start = useCallback(async () => {
    if (!videoRef.current) return
    detectedRef.current = false
    cancelledRef.current = false
    setState('starting')
    setMessage('Preparando la cámara…')

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState('error')
      setMessage('La cámara requiere una conexión segura (HTTPS) y un navegador compatible.')
      return
    }

    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const reader = new BrowserQRCodeReader()
      const available = await BrowserQRCodeReader.listVideoInputDevices().catch(() => [])
      const selected =
        deviceId || available.find((device) => /back|rear|environment|trasera/i.test(device.label))?.deviceId || available[0]?.deviceId

      const controls = await reader.decodeFromVideoDevice(
        selected || undefined,
        videoRef.current,
        (result) => {
          if (!result || detectedRef.current) return
          detectedRef.current = true
          stop()
          setMessage('Código detectado')
          onDetectedRef.current(result.getText())
        }
      )
      if (cancelledRef.current || detectedRef.current) {
        controls.stop()
        return
      }
      controlsRef.current = controls
      const withLabels = await BrowserQRCodeReader.listVideoInputDevices().catch(() => available)
      if (cancelledRef.current) {
        controls.stop()
        return
      }
      setCameras(withLabels)
      setState('scanning')
      setMessage('Apunta la cámara al código QR del socio')
    } catch (error) {
      stop()
      if (cancelledRef.current) return
      setState('error')
      setMessage(scannerError(error))
    }
  }, [deviceId, stop])

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled])')
      if (!focusables || focusables.length === 0) return
      const first = focusables[0] as HTMLElement
      const last = focusables[focusables.length - 1] as HTMLElement
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    void start()
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      cancelledRef.current = true
      stop()
    }
  }, [open, start, stop])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar lector de QR"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgba(5,6,8,0.86)] backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-scanner-title"
        className="relative w-full max-w-lg border border-hairline bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:p-8"
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Control de acceso</p>
        <div className="flex items-start justify-between gap-4">
          <h2 id="qr-scanner-title" className="font-display text-xl font-extrabold uppercase tracking-[-0.03em] text-ink">
            Escanear pase QR
          </h2>
          <Button ref={closeButtonRef} variant="ghost" onClick={onClose} className="min-h-10 px-3 py-2">
            Cerrar
          </Button>
        </div>

        <div className="relative mt-6 aspect-square w-full overflow-hidden border border-hairline bg-canvas">
          <video ref={videoRef} className="h-full w-full object-cover" muted autoPlay playsInline />
          <div className="pointer-events-none absolute inset-6 border-2 border-volt/80 shadow-[0_0_0_9999px_rgba(5,6,8,0.25)]" />
          {state !== 'scanning' ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(5,6,8,0.72)] px-6 text-center">
              <p className="text-sm leading-relaxed text-ink">{message}</p>
            </div>
          ) : null}
        </div>

        <p aria-live="polite" className="mt-4 text-xs leading-relaxed text-muted">
          {message}
        </p>

        {cameras.length > 1 ? (
          <label className="mt-5 block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Cámara</span>
            <select
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              className="w-full border border-hairline bg-canvas p-3 text-sm text-ink outline-none focus:border-volt"
            >
              <option value="">Cámara predeterminada</option>
              {cameras.map((camera, index) => (
                <option key={camera.deviceId || index} value={camera.deviceId}>
                  {camera.label || `Cámara ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          {state === 'error' ? (
            <Button variant="ghost" onClick={() => void start()}>
              Reintentar
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Detener cámara
          </Button>
        </div>
      </div>
    </div>
  )
}
