import { Suspense } from 'react'
import { VerifyGym } from '@/features/auth/VerifyGym/VerifyGym'
import { ThemeToggle } from '@/ui/primitives/ThemeToggle'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Verificar gimnasio · Ludus GYM',
  description: 'Activación del gimnasio registrado en Ludus GYM',
}

export default function VerifyGymPage() {
  return (
    <main className="relative grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <div className="absolute right-5 top-5 z-20 md:right-9 md:top-9">
        <ThemeToggle />
      </div>
      <section className="relative flex flex-col justify-between overflow-hidden border-b border-hairline px-7 py-10 md:px-16 md:py-14 lg:min-h-screen lg:border-b-0 lg:border-r">
        <div aria-hidden className="pointer-events-none absolute -right-40 top-1/4 h-[540px] w-[540px] rounded-full border border-hairline" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full border border-hairline" />
        <p className="relative font-display text-sm font-extrabold uppercase tracking-[0.24em] text-ink">
          Ludus<span className="text-volt">.</span>
        </p>
        <p className="relative max-w-sm text-xs uppercase tracking-[0.2em] text-muted/60">
          Kinetic Obsidiana · Gimnasio verificado
        </p>
      </section>

      <section className="flex items-center justify-center px-7 py-14 md:px-12">
        <Suspense
          fallback={
            <div role="status" className="w-full max-w-md text-sm text-muted">
              Preparando verificación…
            </div>
          }
        >
          <VerifyGym />
        </Suspense>
      </section>
    </main>
  )
}
