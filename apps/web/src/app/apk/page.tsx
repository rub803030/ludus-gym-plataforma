import { ThemeToggle } from '@/ui/primitives/ThemeToggle'

const APK_URL = '/downloads/LudusGYM-Fase5.apk'

export default function ApkPage() {
  return (
    <main className="relative grid min-h-screen place-items-center px-6 py-16">
      <div className="absolute right-5 top-5 z-20 md:right-9 md:top-9">
        <ThemeToggle />
      </div>

      <section className="w-full max-w-xl border border-hairline bg-surface p-8 md:p-12">
        <p className="font-display text-sm font-extrabold uppercase tracking-[0.24em] text-ink">
          Ludus<span className="text-volt">.</span>
        </p>
        <h1 className="mt-8 font-display text-4xl font-extrabold uppercase leading-none tracking-[-0.04em] text-ink">
          App de socios
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Descarga e instala la app Android de Ludus GYM. Disponible únicamente para socios
          con correo verificado.
        </p>

        <a
          href={APK_URL}
          download="LudusGYM-Fase5.apk"
          className="mt-8 inline-flex min-h-14 items-center justify-center bg-volt px-6 text-[11px] font-bold uppercase tracking-[0.16em] text-canvas transition-opacity duration-300 ease-kinetic hover:opacity-90"
        >
          Descargar APK · Fase 5
        </a>

        <ol className="mt-10 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>Abre el enlace desde tu teléfono Android y descarga el archivo.</li>
          <li>Permite la instalación de fuentes desconocidas cuando el navegador lo pida.</li>
          <li>Abre el APK, confirma la instalación e inicia sesión con tu correo de socio.</li>
        </ol>

        <p className="mt-10 border-t border-hairline pt-6 text-xs leading-relaxed text-muted">
          Firmado con el certificado Ludus GYM · 2,3 MB · Android 8.0 (API 26) o superior.
        </p>
      </section>
    </main>
  )
}
