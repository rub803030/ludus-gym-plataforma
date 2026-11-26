import nodemailer from 'nodemailer'
import { getSmtpAccounts, loadEnv, type Env, type SmtpAccount } from '../config/env.js'
import { prisma } from './database/prisma.js'

interface VerificationEmailInput {
  to: string
  name: string
  link: string
  platform: 'web' | 'mobile'
}

interface TemplatedEmailInput {
  to: string
  name: string
  link: string
  platform: 'web' | 'mobile'
  subject: string
  headline: string
  message: string
  cta: string
  footnote: string
}

const COOLDOWN_MS = 15 * 60 * 1000
const cooldownUntil = new Map<string, number>()

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function todayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function smtpAccounts(env: Env): SmtpAccount[] {
  const rotating = getSmtpAccounts(env)
  if (rotating.length > 0) return rotating
  if (env.SMTP_HOST.trim() && env.SMTP_USER.trim() && env.SMTP_PASSWORD) {
    return [{
      user: env.SMTP_USER.trim(),
      password: env.SMTP_PASSWORD,
      from: env.EMAIL_FROM,
      host: env.SMTP_HOST.trim(),
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
    }]
  }
  return []
}

/** Reserva un envío de forma atómica solo si la cuenta no llegó al cupo. */
async function claimSlot(account: string, day: Date, limit: number): Promise<boolean> {
  await prisma.emailSendQuota.upsert({
    where: { account_day: { account, day } },
    create: { account, day, sentCount: 0 },
    update: {},
  })
  const claimed = await prisma.emailSendQuota.updateMany({
    where: { account, day, sentCount: { lt: limit } },
    data: { sentCount: { increment: 1 } },
  })
  return claimed.count === 1
}

/** Devuelve el cupo si el envío falló, para no penalizar a la cuenta. */
async function releaseSlot(account: string, day: Date): Promise<void> {
  await prisma.emailSendQuota.updateMany({
    where: { account, day, sentCount: { gt: 0 } },
    data: { sentCount: { decrement: 1 } },
  })
}

async function pickAccount(accounts: SmtpAccount[], day: Date, limit: number): Promise<SmtpAccount | undefined> {
  const now = Date.now()
  for (const account of accounts) {
    if ((cooldownUntil.get(account.user) ?? 0) > now) continue
    if (await claimSlot(account.user, day, limit)) return account
  }
  return undefined
}

function buildContent(input: TemplatedEmailInput, deliveryNote: string) {
  const text = `${input.message} ${input.link} ${input.footnote}${deliveryNote}`
  const html = `
        <div style="background:#0b0b0d;color:#f5f5f5;font-family:Arial,sans-serif;padding:32px">
          <p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#c8ff2e">Ludus GYM</p>
          <h1 style="font-size:28px;margin:16px 0">${escapeHtml(input.headline)}</h1>
          <p style="color:#a1a1aa;line-height:1.6">${escapeHtml(input.message)}</p>
          <p style="margin:28px 0">
            <a href="${escapeHtml(input.link)}" style="background:#c8ff2e;color:#0b0b0d;padding:14px 22px;text-decoration:none;font-weight:bold">${escapeHtml(input.cta)}</a>
          </p>
          <p style="color:#71717a;font-size:12px">${escapeHtml(input.footnote)}</p>
          ${deliveryNote ? `<p style="color:#71717a;font-size:12px">${escapeHtml(deliveryNote)}</p>` : ''}
        </div>
      `
  return { subject: input.subject, text, html }
}

async function sendViaResend(
  env: Env,
  input: TemplatedEmailInput,
  recipient: string,
  content: ReturnType<typeof buildContent>,
): Promise<{ id?: string; skipped: boolean }> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [recipient],
      subject: content.subject,
      text: content.text,
      html: content.html,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Resend rechazó el correo (${response.status}): ${detail.slice(0, 300)}`)
  }
  const body = (await response.json().catch(() => ({}))) as { id?: string }
  return { id: body.id, skipped: false }
}

/**
 * Entrega de correo con SMTP propio (rotación por cupo diario) y Resend como
 * respaldo. Sin proveedor configurado solo se omite el envío en desarrollo.
 */
async function sendTemplatedEmail(input: TemplatedEmailInput): Promise<{ id?: string; skipped: boolean }> {
  const env = loadEnv()
  const accounts = smtpAccounts(env)
  const fromAddress = (env.EMAIL_FROM.match(/<([^>]+)>/)?.[1] ?? env.EMAIL_FROM).trim()
  const usesTestSender = /@resend\.dev$/i.test(fromAddress)
  const testRecipient = accounts.length > 0 || !usesTestSender ? undefined : env.RESEND_TEST_RECIPIENT
  const recipient = testRecipient || input.to
  const deliveryNote = recipient === input.to ? '' : ` Cuenta: ${input.to}. Entrega de prueba en ${recipient}.`
  const content = buildContent(input, deliveryNote)

  if (accounts.length > 0) {
    const day = todayUtc()
    let lastRejection: Error | undefined

    for (let attempt = 0; attempt < accounts.length; attempt += 1) {
      const account = await pickAccount(accounts, day, env.SMTP_DAILY_LIMIT)
      if (!account) break

      try {
        const transporter = nodemailer.createTransport({
          host: account.host ?? (env.SMTP_HOST.trim() || 'smtp.gmail.com'),
          port: account.port ?? env.SMTP_PORT,
          secure: account.secure ?? env.SMTP_SECURE,
          auth: { user: account.user, pass: account.password },
        })
        const info = await transporter.sendMail({
          from: account.from ?? `Ludus GYM <${account.user}>`,
          to: input.to,
          subject: content.subject,
          text: content.text,
          html: content.html,
        })
        cooldownUntil.delete(account.user)
        return { id: info.messageId, skipped: false }
      } catch (error) {
        const reason = error instanceof Error ? error.message.slice(0, 200) : 'error desconocido'
        cooldownUntil.set(account.user, Date.now() + COOLDOWN_MS)
        await releaseSlot(account.user, day).catch(() => undefined)
        lastRejection = new Error(`SMTP rechazó el envío con la cuenta ${account.user}: ${reason}`)
      }
    }

    if (env.RESEND_API_KEY && !usesTestSender) {
      return sendViaResend(env, input, input.to, content)
    }
    if (lastRejection) throw lastRejection
    throw new Error('Todas las cuentas SMTP alcanzaron el cupo diario; no se pudo enviar el correo')
  }

  if (!env.RESEND_API_KEY) {
    return { skipped: true }
  }
  return sendViaResend(env, input, recipient, content)
}

/** Verificación de correo de socios y equipo. */
export async function sendVerificationEmail(input: VerificationEmailInput): Promise<{ id?: string; skipped: boolean }> {
  const env = loadEnv()
  const audience = input.platform === 'web' ? 'la consola de operación' : 'la app Ludus GYM'
  return sendTemplatedEmail({
    to: input.to,
    name: input.name,
    link: input.link,
    platform: input.platform,
    subject: `Confirma tu correo · Ludus GYM — ${input.to}`,
    headline: 'Confirma tu correo',
    message: `Hola ${input.name}, confirma tu dirección para acceder a ${audience}.`,
    cta: 'Verificar correo',
    footnote: `Este enlace expira en ${env.EMAIL_VERIFICATION_TTL_MINUTES} minutos. Si no fuiste tú, ignora este mensaje.`,
  })
}

/** Enlace de un solo uso que autoriza el alta de un gimnasio. */
export async function sendGymApprovalEmail(input: {
  to: string
  name: string
  gymName: string
  link: string
}): Promise<{ id?: string; skipped: boolean }> {
  const env = loadEnv()
  return sendTemplatedEmail({
    to: input.to,
    name: input.name,
    link: input.link,
    platform: 'web',
    subject: `Autoriza el alta de ${input.gymName} · Ludus GYM`,
    headline: 'Autoriza un gimnasio',
    message: `Hola ${input.name}, ${input.gymName} solicitó su alta en Ludus GYM. Revisa los datos y autoriza el gimnasio.`,
    cta: 'Autorizar gimnasio',
    footnote: `Este enlace expira en ${env.EMAIL_VERIFICATION_TTL_MINUTES} minutos y solo puede usarse una vez.`,
  })
}

/** Aviso al gimnasio cuando un administrador completó la autorización. */
export async function sendGymActivatedEmail(input: {
  to: string
  name: string
  gymName: string
  link: string
}): Promise<{ id?: string; skipped: boolean }> {
  return sendTemplatedEmail({
    to: input.to,
    name: input.name,
    link: input.link,
    platform: 'web',
    subject: `${input.gymName} fue autorizado · Ludus GYM`,
    headline: 'Gimnasio autorizado',
    message: `Hola ${input.name}, ${input.gymName} ya está activo en Ludus GYM. Puedes entrar a la consola con tu cuenta.`,
    cta: 'Ir a la consola',
    footnote: 'Guarda este correo como comprobante de la autorización.',
  })
}
