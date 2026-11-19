'use client'

import { useEffect, useId, useState } from 'react'
import { formatNumber } from '@/lib/format'

export interface NumericInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  currency?: boolean
  label?: string
  suffix?: string
  disabled?: boolean
  id?: string
  placeholder?: string
}

export function NumericInput({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  currency = false,
  label,
  suffix,
  disabled = false,
  id,
  placeholder,
}: NumericInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [draft, setDraft] = useState(() => formatNumber(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(formatNumber(value))
  }, [value, editing])

  function clamp(next: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(next) ? next : min))
  }

  function commit(next: number) {
    const clamped = clamp(next)
    setDraft(formatNumber(clamped))
    onChange(clamped)
  }

  function handleTextChange(raw: string) {
    const clean = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    setDraft(clean)
    if (clean === '' || clean === '.') {
      onChange(min)
      return
    }
    const parsed = Number.parseFloat(clean)
    if (Number.isFinite(parsed)) onChange(clamp(parsed))
  }

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          {label}
        </label>
      ) : null}
      <div
        className={[
          'flex min-h-12 items-stretch border border-hairline bg-surface transition-all duration-300 ease-kinetic',
          'focus-within:border-volt/70 focus-within:shadow-[0_0_0_1px_rgba(204,255,0,0.12)]',
          disabled ? 'opacity-45' : '',
        ].join(' ')}
      >
        {currency ? (
          <span className="flex items-center border-r border-hairline px-3 text-xs font-semibold text-muted">MXN</span>
        ) : null}
        <button
          type="button"
          aria-label="Disminuir"
          disabled={disabled || value <= min}
          onClick={() => commit(value - step)}
          className="flex h-12 w-12 shrink-0 items-center justify-center border-r border-hairline text-lg text-muted transition-colors duration-300 ease-kinetic hover:text-volt disabled:cursor-not-allowed disabled:opacity-30"
        >
          −
        </button>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={draft}
          placeholder={placeholder}
          aria-label={label ?? 'Valor numérico'}
          onChange={(event) => handleTextChange(event.target.value)}
          onFocus={() => {
            setEditing(true)
            setDraft(String(value))
          }}
          onBlur={() => {
            setEditing(false)
            setDraft(formatNumber(value))
          }}
          className="tabular min-w-0 flex-1 bg-transparent px-3 text-right text-base font-semibold text-ink outline-none placeholder:text-muted/50"
        />
        {suffix ? <span className="flex items-center border-l border-hairline px-3 text-xs text-muted">{suffix}</span> : null}
        <button
          type="button"
          aria-label="Aumentar"
          disabled={disabled || value >= max}
          onClick={() => commit(value + step)}
          className="flex h-12 w-12 shrink-0 items-center justify-center border-l border-hairline text-lg text-muted transition-colors duration-300 ease-kinetic hover:text-volt disabled:cursor-not-allowed disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  )
}
