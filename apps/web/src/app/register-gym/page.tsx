import { RegisterGym } from '@/features/auth/RegisterGym/RegisterGym'
import { ThemeToggle } from '@/ui/primitives/ThemeToggle'

export const metadata = {
  title: 'Registrar gimnasio · Ludus GYM',
  description: 'Alta pública de un nuevo gimnasio en Ludus GYM',
}

export default function RegisterGymPage() {
  return (
    <main className="relative grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <div className="absolute right-5 top-5 z-20 md:right-9 md:top-9">
        <ThemeToggle />
      </div>
      <section className="relative flex flex-col justify-between overflow-hidden border-b border-hairline px-7 py-10 md:px-16 md:py-14 lg:min-h-screen lg:border-b-0 lg:border-r">
        <div aria-hidden className="pointer-events-none absolute -right-40 top-1/4 h-[540px] w-[540px] rounded-full border border-hairline" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-1/3 h-[380px] w-[380px] rounded-full border border-hairline" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 right-1/4 h-px w-2/3 bg-gradient-to-r from-transparent via-volt/40 to-transparent" />

        <div className="relative">
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.24em] text-ink">
            Ludus<span className="text-volt">.</span>
          </p>
          <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-muted">Sistema de operación</p>
        </div>

        <div className="relative my-16 lg:my-0">
          <h1 className="font-display text-[clamp(3.2rem,8vw,6.5rem)] font-extrabold uppercase leading-[0.84] tracking-[-0.05em] text-ink">
            TU
            <br />
            <span className="text-volt">GYM</span>
            <br />
            <span className="text-muted">EN LUDUS</span>
          </h1>
          <p className="mt-9 max-w-lg text-sm leading-relaxed text-muted">
            Registra tu gimnasio, confirma tu correo y comienza a operar socios, cobros y control de acceso desde una
            sola consola.
          </p>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/80">
          <span>Kinetic Obsidiana</span>
          <span aria-hidden className="h-1 w-1 rounded-full bg-volt" />
          <span>Alta verificada</span>
          <span aria-hidden className="h-1 w-1 rounded-full bg-volt" />
          <span>Uso interno</span>
        </div>
      </section>

      <section className="flex items-center justify-center px-7 py-14 md:px-16">
        <RegisterGym />
      </section>
    </main>
  )
}
