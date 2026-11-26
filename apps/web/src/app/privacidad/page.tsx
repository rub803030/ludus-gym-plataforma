import { ThemeToggle } from '@/ui/primitives/ThemeToggle'

export const metadata = {
  title: 'Aviso de privacidad · Ludus GYM',
  description: 'Cómo trata Ludus GYM los datos de socios de la app móvil y la consola web.',
}

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen px-6 py-16">
      <div className="absolute right-5 top-5 z-20 md:right-9 md:top-9">
        <ThemeToggle />
      </div>

      <section className="mx-auto w-full max-w-3xl border border-hairline bg-surface p-8 md:p-12">
        <p className="font-display text-sm font-extrabold uppercase tracking-[0.24em] text-ink">
          Ludus<span className="text-volt">.</span>
        </p>
        <h1 className="mt-8 font-display text-4xl font-extrabold uppercase leading-none tracking-[-0.04em] text-ink">
          Aviso de privacidad
        </h1>
        <p className="mt-4 text-xs uppercase tracking-[0.12em] text-muted">
          Última actualización: 26 de noviembre de 2026
        </p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted">
          <div>
            <h2 className="font-display text-base font-bold uppercase tracking-[0.08em] text-ink">
              1. Responsable del tratamiento
            </h2>
            <p className="mt-3">
              Ludus GYM es responsable de los datos que nos compartes al usar la app de socios,
              esta consola y nuestros canales de soporte. Para consultas sobre tus datos puedes
              escribir a{' '}
              <a className="text-ink underline underline-offset-4" href="mailto:operacion@ludusgym.mx">
                operacion@ludusgym.mx
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="font-display text-base font-bold uppercase tracking-[0.08em] text-ink">
              2. Datos que recopilamos
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Identificación y contacto: nombre, correo electrónico, teléfono y documento cuando los proporcionas.</li>
              <li>Membresía y operación: gimnasio asignado, código de socio, estatus de pago, reservas y movimientos de caja.</li>
              <li>Salud y actividad: rutinas, registros de entrenamiento y nutrición que tú o el gimnasio capturan.</li>
              <li>Acceso y dispositivo: credencial QR de corta duración, identificador de dispositivo, hora de entrada y registro de accesos.</li>
              <li>Datos técnicos: dirección IP, tipo de dispositivo y registros de errores necesarios para mantener el servicio.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-display text-base font-bold uppercase tracking-[0.08em] text-ink">
              3. Para qué los usamos
            </h2>
            <p className="mt-3">
              Usamos tus datos para verificar tu identidad, habilitar tu pase de acceso, administrar
              tu membresía y cobros, mostrarte tu rutina y nutrición, gestionar reservas, responder
              soporte y cumplir obligaciones legales. No vendemos tus datos personales ni los usamos
              para publicidad de terceros.
            </p>
          </div>

          <div>
            <h2 className="font-display text-base font-bold uppercase tracking-[0.08em] text-ink">
              4. Conservación y seguridad
            </h2>
            <p className="mt-3">
              Conservamos la información mientras tu membresía esté vigente y durante el plazo que
              exijan la operación del gimnasio y la normativa aplicable. Las contraseñas se guardan
              como hashes, los campos sensibles se cifran y las sesiones usan cookies seguras. El QR
              se renueva cada 30 segundos y la credencial sin conexión caduca a los 10 minutos.
            </p>
          </div>

          <div>
            <h2 className="font-display text-base font-bold uppercase tracking-[0.08em] text-ink">
              5. Tus derechos
            </h2>
            <p className="mt-3">
              Puedes solicitar acceso, corrección, eliminación, oposición o revocación de tu
              consentimiento escribiendo a la dirección de contacto. También puedes pedir la
              baja de tu cuenta a través del gimnasio. Responderemos las solicitudes conforme a la
              Ley Federal de Protección de Datos Personales en Posesión de los Particulares.
            </p>
          </div>

          <div>
            <h2 className="font-display text-base font-bold uppercase tracking-[0.08em] text-ink">
              6. Cambios en este aviso
            </h2>
            <p className="mt-3">
              Publicaremos cualquier cambio en esta página y actualizaremos la fecha de la parte
              superior. Si el cambio afecta tus derechos, te lo comunicaremos antes de aplicarlo.
            </p>
          </div>
        </div>

        <p className="mt-10 border-t border-hairline pt-6 text-xs text-muted">
          <a className="text-ink underline underline-offset-4" href="/apk">
            Volver a la descarga de la app
          </a>
        </p>
      </section>
    </main>
  )
}
