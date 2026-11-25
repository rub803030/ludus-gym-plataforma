import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  gymProfileSchema,
  registerGymSchema,
  verifyGymSchema,
} from '@ludus/shared'
import type { Gym } from '@prisma/client'
import { prisma } from '../../shared/database/prisma.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { requireAuth } from '../../shared/http.js'
import { getPrincipal } from '../../shared/middleware/request-context.js'
import { requirePermission } from '../../shared/middleware/rbac.js'
import { hashPassword } from '../../shared/password.js'
import { writeAudit } from '../../shared/audit.js'
import { verificationResponse } from '../auth/email-verification.js'
import { issueGymVerification, verifyGymToken } from './gym-verification.js'

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new DomainError('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'Datos inválidos', 400)
  return result.data
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

async function nextSlug(base: string): Promise<string> {
  let slug = base.length >= 3 ? base : `gym-${base}`
  let suffix = 2
  while (await prisma.gym.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`
    suffix += 1
  }
  return slug
}

function toGymView(gym: Gym) {
  return {
    id: gym.id,
    name: gym.name,
    slug: gym.slug,
    status: gym.status,
    publicCode: gym.publicCode,
    enrollmentQrToken: gym.enrollmentQrToken,
    timezone: gym.timezone,
    capacity: gym.capacity,
    currency: gym.currency,
    address: gym.address,
    phone: gym.phone,
    openingHours: gym.openingHours,
    logoUrl: gym.logoUrl,
  }
}

function profileData(body: z.infer<typeof gymProfileSchema>) {
  return {
    name: body.name,
    address: body.address,
    phone: body.phone,
    openingHours: body.openingHours,
    logoUrl: body.logoUrl,
    timezone: body.timezone,
    capacity: body.capacity,
    currency: body.currency,
  }
}

export async function registerGymRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/gyms/register', async (req, reply) => {
    const body = parse(registerGymSchema, req.body)
    const ownerEmail = body.email.toLowerCase()
    const existingOwner = await prisma.staffUser.findFirst({
      where: { email: { equals: ownerEmail, mode: 'insensitive' }, deletedAt: null },
    })
    if (existingOwner) {
      throw new DomainError('CONFLICT', 'Ya existe una cuenta con ese correo', 409)
    }

    const slug = await nextSlug(body.slug ? slugify(body.slug) : slugify(body.gymName))
    const gym = await prisma.gym.create({
      data: {
        name: body.gymName,
        slug,
        status: 'PENDING_VERIFICATION',
        timezone: body.timezone ?? 'America/Mexico_City',
        capacity: body.capacity ?? 20,
        currency: body.currency ?? 'MXN',
        address: body.address,
        phone: body.phone,
        openingHours: body.openingHours,
      },
    })
    const owner = await prisma.staffUser.create({
      data: {
        gymId: gym.id,
        email: ownerEmail,
        passwordHash: hashPassword(body.password),
        fullName: body.ownerName,
        role: 'OWNER',
        emailVerified: false,
      },
    })
    const issued = await issueGymVerification({
      gymId: gym.id,
      email: owner.email,
      ownerName: owner.fullName,
    })

    reply.code(201)
    return {
      gym: { id: gym.id, name: gym.name, slug: gym.slug, status: gym.status },
      owner: { email: owner.email, fullName: owner.fullName },
      verification: verificationResponse(issued),
    }
  })

  app.post('/api/gyms/verify', async (req) => {
    const { token } = parse(verifyGymSchema, req.body)
    const gym = await verifyGymToken(token)
    return {
      ok: true,
      gym: {
        id: gym.id,
        name: gym.name,
        status: gym.status,
        publicCode: gym.publicCode,
        enrollmentQrToken: gym.enrollmentQrToken,
      },
    }
  })

  app.get('/api/gyms/me', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    const gym = await prisma.gym.findFirst({ where: { id: principal.gymId, deletedAt: null } })
    if (!gym) throw new DomainError('NOT_FOUND', 'Gimnasio no encontrado', 404)
    return toGymView(gym)
  })

  app.patch('/api/gyms/me', { preHandler: [requireAuth, requirePermission('plans:manage')] }, async (req) => {
    const principal = getPrincipal(req)
    const body = parse(gymProfileSchema, req.body)
    const before = await prisma.gym.findFirst({ where: { id: principal.gymId, deletedAt: null } })
    if (!before) throw new DomainError('NOT_FOUND', 'Gimnasio no encontrado', 404)
    const gym = await prisma.gym.update({ where: { id: before.id }, data: profileData(body) })
    await writeAudit({
      gymId: gym.id,
      actorId: principal.id,
      actorRole: principal.role,
      action: 'gym.update',
      entity: 'gym',
      entityId: gym.id,
      before: { name: before.name, address: before.address, phone: before.phone },
      after: { name: gym.name, address: gym.address, phone: gym.phone },
    })
    return toGymView(gym)
  })
}
