export interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
}

export function Skeleton({ width = '100%', height = 12, className = '' }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-sm bg-[var(--color-surface-raised)] ${className}`}
      style={{ width, height }}
    />
  )
}

export interface TableSkeletonProps {
  rows?: number
  columns?: number
}

/** Mirrors DenseTable geometry: 48px rows separated by hairlines. */
export function TableSkeleton({ rows = 6, columns = 5 }: TableSkeletonProps) {
  return (
    <div role="status" aria-label="Cargando datos" aria-busy className="w-full">
      <div
        className="grid gap-6 border-b border-hairline px-4 py-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} width="60%" height={8} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid min-h-12 items-center gap-6 border-b border-hairline px-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton key={columnIndex} width={columnIndex % 3 === 0 ? '85%' : '55%'} height={10} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function MetricSkeleton() {
  return (
    <div className="border-t border-hairline pt-5">
      <Skeleton width="45%" height={8} />
      <Skeleton width="70%" height={30} className="mt-5" />
      <Skeleton width="35%" height={8} className="mt-4" />
    </div>
  )
}
