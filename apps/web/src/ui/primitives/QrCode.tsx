function hash(value: string): number {
  let result = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16_777_619)
  }
  return result >>> 0
}

function finderModule(x: number, y: number, size: number): boolean | null {
  const topLeft = x < 7 && y < 7
  const topRight = x >= size - 7 && y < 7
  const bottomLeft = x < 7 && y >= size - 7
  if (!topLeft && !topRight && !bottomLeft) return null
  const localX = topRight ? x - (size - 7) : x
  const localY = bottomLeft ? y - (size - 7) : y
  const ring = localX === 0 || localX === 6 || localY === 0 || localY === 6
  const core = localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4
  return ring || core
}

export interface QrCodeProps {
  value: string
  size?: number
  className?: string
}

/** Deterministic, dependency-free QR-style receipt code rendered as an SVG grid. */
export function QrCode({ value, size = 132, className = '' }: QrCodeProps) {
  const count = 21
  let seed = hash(value || 'ludus')
  const modules: boolean[] = []
  for (let index = 0; index < count * count; index += 1) {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0
    modules.push(((seed >>> 24) & 0xff) > 127)
  }

  return (
    <svg
      role="img"
      aria-label={`Código de comprobante ${value}`}
      width={size}
      height={size}
      viewBox={`0 0 ${count} ${count}`}
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={count} height={count} fill="transparent" />
      {modules.map((on, index) => {
        const x = index % count
        const y = Math.floor(index / count)
        const finder = finderModule(x, y, count)
        const active = finder === null ? on : finder
        return active ? <rect key={index} x={x} y={y} width={1} height={1} fill="var(--color-ink)" /> : null
      })}
    </svg>
  )
}
