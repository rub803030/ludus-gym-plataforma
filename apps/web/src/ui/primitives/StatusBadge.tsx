export type StatusValue =
  | 'active'
  | 'pending'
  | 'expired'
  | 'overdue'
  | 'inactive'
  | 'paid'
  | 'refunded'
  | 'failed'
  | 'open'
  | 'closed'
  | 'info'
  | 'warning'
  | 'critical'
  | 'valid'
  | 'invalid'
  | 'duplicate'

interface BadgeStyle {
  label: string
  dot: string
  text: string
}

const STYLES: Record<StatusValue, BadgeStyle> = {
  active: { label: 'Activo', dot: 'bg-volt', text: 'text-volt' },
  pending: { label: 'Pendiente', dot: 'bg-muted', text: 'text-muted' },
  expired: { label: 'Vencido', dot: 'bg-ignition', text: 'text-ignition' },
  overdue: { label: 'Atrasado', dot: 'bg-ignition', text: 'text-ignition' },
  inactive: { label: 'Inactivo', dot: 'bg-muted', text: 'text-muted' },
  paid: { label: 'Pagado', dot: 'bg-emerald', text: 'text-emerald' },
  refunded: { label: 'Reembolsado', dot: 'bg-muted', text: 'text-muted' },
  failed: { label: 'Fallido', dot: 'bg-ignition', text: 'text-ignition' },
  open: { label: 'Abierta', dot: 'bg-emerald', text: 'text-emerald' },
  closed: { label: 'Cerrada', dot: 'bg-muted', text: 'text-muted' },
  info: { label: 'Información', dot: 'bg-muted', text: 'text-muted' },
  warning: { label: 'Atención', dot: 'bg-ignition', text: 'text-ignition' },
  critical: { label: 'Crítico', dot: 'bg-ignition', text: 'text-ignition' },
  valid: { label: 'Válido', dot: 'bg-emerald', text: 'text-emerald' },
  invalid: { label: 'Inválido', dot: 'bg-ignition', text: 'text-ignition' },
  duplicate: { label: 'Duplicado', dot: 'bg-muted', text: 'text-muted' },
}

export interface StatusBadgeProps {
  status: StatusValue
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const style = STYLES[status] ?? STYLES.inactive
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap border border-hairline px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${style.text} ${className}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
      {label ?? style.label}
    </span>
  )
}
