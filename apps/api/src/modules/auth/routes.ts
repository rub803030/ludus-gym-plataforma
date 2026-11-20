import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { mobileLoginSchema, webLoginSchema } from '@ludus/shared'
import { DomainError } from '../../shared/errors/domain-error.js'
import { requireAuth } from '../../shared/http.js'
import { getCsrfSecret, signCsrf } from '../../shared/middleware/csrf.js'
import { getPrincipal } from '../../shared/middleware/request-context.js'
import { prisma } from '../../shared/database/prisma.js'
import {
  loginMember,
  loginWeb,
  logout,
  rotateRefresh,
} from './auth-service.js'

const refreshSchema = z.object({ refreshToken: z.string().min(20) })
const deviceSchema = z.object({ deviceId: z.string().min(6).max(128).default('ludus-android') })

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new DomainError('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }
  return result.data
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production'
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict' as const,
    path: '/',
  }

  app.post('/api/auth/web/login', async (req, reply) => {
    const body = parse(webLoginSchema, req.body)
    const result = await loginWeb(body.email, body.password)
    const sessionId = randomUUID()
    const csrfToken = signCsrf(getCsrfSecret(), sessionId)
    reply
      .setCookie('ludus_sid', sessionId, cookieOptions)
      .setCookie('ludus_token', result.accessToken, cookieOptions)
      .setCookie('ludus_refresh', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 3600 })
      .setCookie('ludus_csrf', csrfToken, { ...cookieOptions, httpOnly: false })
    return { principal: result.principal, csrfToken }
  })

  app.post('/api/auth/mobile/login', async (req) => {
    const body = parse(mobileLoginSchema, req.body)
    const device = parse(deviceSchema, req.body)
    const result = await loginMember(body.email, body.password, device.deviceId ?? 'ludus-android')
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      principal: result.principal,
    }
  })

  app.post('/api/auth/refresh', async (req, reply) => {
    const bodyRaw = req.body as Record<string, unknown> | undefined
    const token = bodyRaw?.['refreshToken'] ?? req.cookies['ludus_refresh']
    const result = await rotateRefresh(parse(refreshSchema, { refreshToken: token }).refreshToken)
    if (result.principal.platform === 'web') {
      reply
        .setCookie('ludus_token', result.accessToken, cookieOptions)
        .setCookie('ludus_refresh', result.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 3600 })
    }
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      principal: result.principal,
    }
  })

  app.post('/api/auth/logout', { preHandler: requireAuth }, async (req, reply) => {
    const principal = getPrincipal(req)
    await logout(principal.jti, principal.id)
    reply
      .clearCookie('ludus_token', { path: '/' })
      .clearCookie('ludus_refresh', { path: '/' })
      .clearCookie('ludus_sid', { path: '/' })
      .clearCookie('ludus_csrf', { path: '/' })
    return { ok: true }
  })

  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    const base = { ...principal }
    if (principal.platform === 'mobile') {
      const member = await prisma.member.findUnique({
        where: { id: principal.id },
        include: { memberships: { where: { status: 'ACTIVE' }, take: 1, include: { plan: true } } },
      })
      const membership = member?.memberships[0]
      return {
        ...base,
        name: member ? `${member.firstName} ${member.lastName}` : '',
        email: member?.email,
        membershipStatus: member?.status,
        membershipEndDate: membership?.endDate?.toISOString() ?? null,
        planName: membership?.plan.name ?? null,
      }
    }
    const staff = await prisma.staffUser.findUnique({ where: { id: principal.id } })
    return { ...base, name: staff?.fullName ?? '', email: staff?.email }
  })
}
