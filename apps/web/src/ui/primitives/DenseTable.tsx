'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Skeleton } from '@/ui/primitives/Skeleton'

export interface DenseColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}

export interface DenseTableProps<T> {
  columns: Array<DenseColumn<T>>
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  skeletonRows?: number
  emptyMessage?: string
  onRowClick?: (row: T) => void
  ariaLabel?: string
}

const ALIGN: Record<NonNullable<DenseColumn<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

export function DenseTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 6,
  emptyMessage = 'No hay registros para mostrar.',
  onRowClick,
  ariaLabel = 'Tabla de datos',
}: DenseTableProps<T>) {
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (activeIndex > Math.max(rows.length - 1, 0)) setActiveIndex(0)
  }, [rows.length, activeIndex])

  function focusRow(index: number) {
    if (rows.length === 0) return
    const next = Math.max(0, Math.min(index, rows.length - 1))
    setActiveIndex(next)
    rowRefs.current[next]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>, index: number) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusRow(index + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusRow(index - 1)
        break
      case 'Home':
        event.preventDefault()
        focusRow(0)
        break
      case 'End':
        event.preventDefault()
        focusRow(rows.length - 1)
        break
      case 'Enter':
      case ' ':
        if (onRowClick) {
          event.preventDefault()
          onRowClick(rows[index] as T)
        }
        break
      default:
        break
    }
  }

  return (
    <div className="w-full overflow-x-auto">
      <table aria-label={ariaLabel} className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={[
                  'px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted',
                  ALIGN[column.align ?? 'left'],
                  column.className ?? '',
                ].join(' ')}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="min-h-12 border-b border-hairline">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-4">
                      <Skeleton width={column.align === 'right' ? '45%' : '75%'} height={10} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.length === 0
              ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-14 text-center text-sm text-muted">
                      {emptyMessage}
                    </td>
                  </tr>
                )
              : rows.map((row, index) => (
                  <tr
                    key={rowKey(row)}
                    ref={(element) => {
                      rowRefs.current[index] = element
                    }}
                    tabIndex={index === activeIndex ? 0 : -1}
                    onFocus={() => setActiveIndex(index)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    aria-label={onRowClick ? 'Seleccionar registro' : undefined}
                    className={[
                      'min-h-12 border-b border-hairline transition-colors duration-300 ease-kinetic',
                      onRowClick ? 'cursor-pointer hover:bg-[var(--color-surface-raised)]' : '',
                      'focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-volt',
                    ].join(' ')}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={[
                          'px-4 py-3.5 text-[13px] text-ink/90',
                          ALIGN[column.align ?? 'left'],
                          column.className ?? '',
                        ].join(' ')}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
        </tbody>
      </table>
    </div>
  )
}
