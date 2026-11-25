import { loadEnv } from '../config/env.js'

interface VerificationEmailInput {
  to: string
  name: string
  link: string
  platform: 'web' | 'mobile'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Envío transaccional con Resend. Sin SDK: usa fetch nativo de Node 20. */
export async function sendVerificationEmail(input: VerificationEmailInput): Promise<{ id?: string; skipped: boolean }> {
  const env = loadEnv()
  if (!env.RESEND_API_KEY) {
    return { skipped: true }
  }

  const audience = input.platform === 'web' ? 'la consola de operación' : 'la app Ludus GYM'
  // En desarrollo, onboarding@resend.dev solo entrega al dueño de la cuenta:
  // RESEND_TEST_RECIPIENT permite probar sin salir de esa bandeja. En producción
  // NUNCA se redirige: el correo debe llegar a la dirección real del socio.
  const testRecipient = env.NODE_ENV === 'production' ? undefined : env.RESEND_TEST_RECIPIENT
  const recipient = testRecipient || input.to
  const deliveryNote =
    recipient === input.to ? '' : ` Cuenta: ${input.to}. Entrega de prueba en ${recipient}.`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [recipient],
      subject: `Confirma tu correo · Ludus GYM — ${input.to}`,
      text: `Hola ${input.name}, confirma tu correo para acceder a ${audience}: ${input.link} Este enlace expira en ${env.EMAIL_VERIFICATION_TTL_MINUTES} minutos.${deliveryNote}`,
      html: `
        <div style="background:#0b0b0d;color:#f5f5f5;font-family:Arial,sans-serif;padding:32px">
          <p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#c8ff2e">Ludus GYM</p>
          <h1 style="font-size:28px;margin:16px 0">Confirma tu correo</h1>
          <p style="color:#a1a1aa;line-height:1.6">Hola ${escapeHtml(input.name)}, verifica tu dirección para acceder a ${audience}.</p>
          <p style="margin:28px 0">
            <a href="${escapeHtml(input.link)}" style="background:#c8ff2e;color:#0b0b0d;padding:14px 22px;text-decoration:none;font-weight:bold">Verificar correo</a>
          </p>
          <p style="color:#71717a;font-size:12px">Este enlace expira en ${env.EMAIL_VERIFICATION_TTL_MINUTES} minutos. Si no fuiste tú, ignora este mensaje.</p>
          ${deliveryNote ? `<p style="color:#71717a;font-size:12px">${escapeHtml(deliveryNote)}</p>` : ''}
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Resend rechazó el correo (${response.status}): ${detail.slice(0, 300)}`)
  }
  const body = (await response.json().catch(() => ({}))) as { id?: string }
  return { id: body.id, skipped: false }
}
