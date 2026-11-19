'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'ghost' | 'destructive'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  fullWidth?: boolean
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-volt text-canvas hover:brightness-110 hover:shadow-[0_0_24px_rgba(204,255,0,0.16)]',
  ghost: 'border border-hairline bg-transparent text-ink hover:border-volt/50 hover:text-volt',
  destructive: 'bg-ignition text-canvas hover:brightness-110',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading = false, fullWidth = false, className = '', children, disabled, type = 'button', ...rest },
  ref
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex min-h-12 items-center justify-center gap-2.5 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em]',
        'transition-all duration-300 ease-kinetic active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
        VARIANTS[variant],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  )
})
