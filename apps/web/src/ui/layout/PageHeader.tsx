import type { ReactNode } from 'react'

export interface PageHeaderProps {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-9 flex flex-col gap-6 border-b border-hairline pb-7 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mb-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-volt">
          <span aria-hidden className="h-px w-6 bg-volt" />
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-[-0.03em] text-ink md:text-[2.6rem]">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  )
}
