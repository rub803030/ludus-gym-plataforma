import { QRCodeSVG } from 'qrcode.react'

export interface QrCodeProps {
  value: string
  size?: number
  className?: string
}

/** Código QR real y escaneable del comprobante de cobro. */
export function QrCode({ value, size = 132, className = '' }: QrCodeProps) {
  return (
    <QRCodeSVG
      value={value || 'LUDUS-GYM'}
      size={size}
      level="M"
      marginSize={2}
      bgColor="#ffffff"
      fgColor="#0b0c0e"
      title={`Código de comprobante ${value}`}
      className={className}
      shapeRendering="crispEdges"
    />
  )
}
