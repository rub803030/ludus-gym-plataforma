'use client'

import { useEffect, useState } from 'react'
import { ThemeIcon } from './ThemeIcon'

export const THEME_STORAGE_KEY = 'ludus-theme'

type Theme = 'dark' | 'light'

interface ThemeToggleProps {
  /** `icon` para la barra superior; `labeled` para el panel de preferencias. */
  variant?: 'icon' | 'labeled'
  className?: string
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* La preferencia sigue aplicada durante la sesión actual. */
  }
}

/** Luna en oscuro, sol en claro. Misma preferencia en toda la plataforma. */
export function ThemeToggle({ variant = 'icon', className = '' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored)
      document.documentElement.dataset.theme = stored
    }
  }, [])

  function toggle(next?: Theme) {
    const value = next ?? (theme === 'dark' ? 'light' : 'dark')
    setTheme(value)
    applyTheme(value)
  }

  const currentLabel = theme === 'dark' ? 'Tema oscuro' : 'Tema claro'
  const nextLabel = theme === 'dark' ? 'claro' : 'oscuro'

  if (variant === 'labeled') {
    return (
      <div className={`grid grid-cols-2 gap-px border border-hairline bg-[var(--color-hairline)] ${className}`}>
        {(['dark', 'light'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              if (theme !== option) toggle(option)
            }}
            aria-pressed={theme === option}
            className={[
              'flex min-h-14 items-center justify-center gap-3 px-4 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors duration-300 ease-kinetic',
              theme === option ? 'bg-volt text-canvas' : 'bg-surface text-muted hover:text-ink',
            ].join(' ')}
          >
            <ThemeIcon theme={option} />
            {option === 'dark' ? 'Tema oscuro' : 'Tema claro'}
          </button>
        ))}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => toggle()}
      aria-label={`Cambiar a tema ${nextLabel}`}
      title={currentLabel}
      className={`flex h-12 w-12 items-center justify-center border border-hairline bg-canvas text-muted transition-colors duration-300 ease-kinetic hover:border-volt/50 hover:text-volt ${className}`}
    >
      <ThemeIcon theme={theme} />
    </button>
  )
}
