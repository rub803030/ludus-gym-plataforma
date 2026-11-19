import type { ReactNode } from 'react'

export interface EmptyStateProps {
  eyebrow?: string
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ eyebrow = 'Sin datos', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-56 flex-col items-start justify-center border-t border-hairline py-12">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{eyebrow}</p>
      <p className="font-display text-lg font-extrabold uppercase tracking-[-0.03em] text-ink">{title}</p>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
