import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../shared/database/prisma.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { getPrincipal } from '../../shared/middleware/request-context.js'
import { requirePermission } from '../../shared/middleware/rbac.js'
import { requireAuth } from '../../shared/http.js'
import { activeMemberGymScope, memberGymScope } from '../../shared/gym-membership.js'

const routineSchema = z.object({
  memberId: z.string().uuid(),
  title: z.string().min(2).max(120),
  weekStart: z.string().date(),
  notes: z.string().max(1000).optional(),
  exercises: z.array(z.object({
    name: z.string().min(2).max(120),
    dayOfWeek: z.number().int().min(1).max(7),
    sets: z.number().int().positive(),
    reps: z.number().int().positive(),
    restSeconds: z.number().int().min(0).default(60),
  })).default([]),
})

const logSchema = z.object({
  exerciseId: z.string().uuid(),
  weightKg: z.number().min(0).optional(),
  repsDone: z.number().int().min(0).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  performedAt: z.string().datetime().optional(),
})

const nutritionSchema = z.object({
  memberId: z.string().uuid(),
  title: z.string().min(2).max(120),
  calories: z.number().int().positive(),
  proteinG: z.number().int().min(0),
  carbsG: z.number().int().min(0),
  fatG: z.number().int().min(0),
  meals: z.array(z.object({
    name: z.string().min(2).max(120),
    mealTime: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    calories: z.number().int().min(0),
    proteinG: z.number().int().min(0).default(0),
    carbsG: z.number().int().min(0).default(0),
    fatG: z.number().int().min(0).default(0),
  })).default([]),
})

const classSchema = z.object({
  title: z.string().min(2).max(120),
  startsAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240).default(60),
  capacity: z.number().int().min(1).max(500).default(20),
})

export async function registerWorkoutRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/classes', { preHandler: [requireAuth, requirePermission('routines:assign')] }, async (req, reply) => {
    const body = classSchema.parse(req.body)
    const principal = getPrincipal(req)
    const gymClass = await prisma.gymClass.create({
      data: {
        gymId: principal.gymId,
        title: body.title,
        startsAt: new Date(body.startsAt),
        durationMinutes: body.durationMinutes,
        capacity: body.capacity,
      },
    })
    reply.code(201)
    return { id: gymClass.id, title: gymClass.title, startsAt: gymClass.startsAt.toISOString() }
  })

  app.get('/api/routines', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    const memberId = principal.role === 'MEMBER'
      ? principal.id
      : typeof (req.query as Record<string, unknown>)['memberId'] === 'string'
        ? String((req.query as Record<string, unknown>)['memberId'])
        : null
    if (!memberId) throw new DomainError('VALIDATION_ERROR', 'memberId requerido', 400)
    const gymId = principal.activeGymId ?? principal.gymId
    if (principal.role === 'MEMBER' && gymId) {
      const affiliation = await prisma.member.findFirst({
        where: { id: principal.id, deletedAt: null, ...activeMemberGymScope(gymId) },
        select: { id: true },
      })
      if (!affiliation) throw new DomainError('NO_GYM', 'No tienes una afiliación activa en este gimnasio', 403)
    }
    const routines = await prisma.routine.findMany({
      where: {
        memberId,
        gymId,
        deletedAt: null,
        ...(principal.role !== 'MEMBER' ? { member: { is: memberGymScope(gymId) } } : {}),
      },
      include: { exercises: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { weekStart: 'desc' },
      take: 10,
    })
    return routines.map((r) => ({
      id: r.id,
      title: r.title,
      weekStart: r.weekStart.toISOString().slice(0, 10),
      notes: r.notes,
      exercises: r.exercises.map((e) => ({
        id: e.id,
        name: e.name,
        dayOfWeek: e.dayOfWeek,
        sets: e.sets,
        reps: e.reps,
        restSeconds: e.restSeconds,
      })),
    }))
  })

  app.post('/api/routines', { preHandler: [requireAuth, requirePermission('routines:assign')] }, async (req, reply) => {
    const body = routineSchema.parse(req.body)
    const principal = getPrincipal(req)
    const member = await prisma.member.findFirst({
      where: { id: body.memberId, deletedAt: null, ...activeMemberGymScope(principal.gymId) },
      select: { id: true },
    })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio sin afiliación activa en este gimnasio', 404)
    const routine = await prisma.routine.create({
      data: {
        gymId: principal.gymId,
        memberId: body.memberId,
        title: body.title,
        weekStart: new Date(body.weekStart),
        notes: body.notes,
        assignedBy: principal.id,
        exercises: {
          create: body.exercises.map((e, index) => ({
            name: e.name,
            dayOfWeek: e.dayOfWeek,
            sets: e.sets,
            reps: e.reps,
            restSeconds: e.restSeconds,
            sortOrder: index,
          })),
        },
      },
    })
    reply.code(201)
    return { id: routine.id, title: routine.title }
  })

  app.post('/api/workout-logs', { preHandler: requireAuth }, async (req, reply) => {
    const body = logSchema.parse(req.body)
    const principal = getPrincipal(req)
    const gymId = principal.activeGymId ?? principal.gymId
    const exercise = await prisma.routineExercise.findFirst({
      where: {
        id: body.exerciseId,
        routine: { is: { memberId: principal.id, gymId, deletedAt: null } },
      },
      select: { id: true },
    })
    if (!exercise) throw new DomainError('NOT_FOUND', 'Ejercicio asignado no encontrado', 404)
    const log = await prisma.workoutLog.create({
      data: {
        memberId: principal.id,
        exerciseId: body.exerciseId,
        weightKg: body.weightKg,
        repsDone: body.repsDone,
        rpe: body.rpe,
        performedAt: body.performedAt ? new Date(body.performedAt) : new Date(),
        syncedFromDevice: true,
      },
    })
    reply.code(201)
    return { id: log.id, performedAt: log.performedAt.toISOString() }
  })

  app.get('/api/workout-logs', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    const gymId = principal.activeGymId ?? principal.gymId
    const affiliation = await prisma.member.findFirst({
      where: { id: principal.id, deletedAt: null, ...activeMemberGymScope(gymId) },
      select: { id: true },
    })
    if (!affiliation) throw new DomainError('NO_GYM', 'No tienes una afiliación activa en este gimnasio', 403)
    const logs = await prisma.workoutLog.findMany({
      where: {
        memberId: principal.id,
        exercise: { is: { routine: { is: { gymId } } } },
      },
      orderBy: { performedAt: 'desc' },
      take: 100,
    })
    return logs.map((l) => ({
      id: l.id,
      exerciseId: l.exerciseId,
      weightKg: l.weightKg ? Number(l.weightKg) : null,
      repsDone: l.repsDone,
      rpe: l.rpe,
      performedAt: l.performedAt.toISOString(),
    }))
  })

  app.get('/api/nutrition-plans', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    const memberId = principal.role === 'MEMBER'
      ? principal.id
      : String((req.query as Record<string, unknown>)['memberId'] ?? '')
    if (!memberId) throw new DomainError('VALIDATION_ERROR', 'memberId requerido', 400)
    const gymId = principal.activeGymId ?? principal.gymId
    const member = await prisma.member.findFirst({
      where: {
        id: memberId,
        deletedAt: null,
        ...(principal.role === 'MEMBER' ? activeMemberGymScope(gymId) : memberGymScope(gymId)),
      },
      select: { id: true },
    })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio no afiliado a este gimnasio', 404)
    const plans = await prisma.nutritionPlan.findMany({
      where: { memberId, gymId, deletedAt: null },
      include: { meals: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    return plans.map((p) => ({
      id: p.id,
      title: p.title,
      calories: p.calories,
      proteinG: p.proteinG,
      carbsG: p.carbsG,
      fatG: p.fatG,
      meals: p.meals.map((m) => ({
        id: m.id,
        name: m.name,
        mealTime: m.mealTime,
        calories: m.calories,
        proteinG: m.proteinG,
        carbsG: m.carbsG,
        fatG: m.fatG,
      })),
    }))
  })

  app.post('/api/nutrition-plans', { preHandler: [requireAuth, requirePermission('nutrition:assign')] }, async (req, reply) => {
    const body = nutritionSchema.parse(req.body)
    const principal = getPrincipal(req)
    const member = await prisma.member.findFirst({
      where: { id: body.memberId, deletedAt: null, ...activeMemberGymScope(principal.gymId) },
      select: { id: true },
    })
    if (!member) throw new DomainError('NOT_FOUND', 'Socio sin afiliación activa en este gimnasio', 404)
    const plan = await prisma.nutritionPlan.create({
      data: {
        gymId: principal.gymId,
        memberId: body.memberId,
        title: body.title,
        calories: body.calories,
        proteinG: body.proteinG,
        carbsG: body.carbsG,
        fatG: body.fatG,
        assignedBy: principal.id,
        meals: {
          create: body.meals.map((m, index) => ({
            name: m.name,
            mealTime: m.mealTime,
            calories: m.calories,
            proteinG: m.proteinG,
            carbsG: m.carbsG,
            fatG: m.fatG,
            sortOrder: index,
          })),
        },
      },
    })
    reply.code(201)
    return { id: plan.id, title: plan.title }
  })

  app.get('/api/classes', { preHandler: requireAuth }, async (req) => {
    const principal = getPrincipal(req)
    const classes = await prisma.gymClass.findMany({
      where: { gymId: principal.gymId, startsAt: { gte: new Date(Date.now() - 6 * 3600_000) } },
      include: { _count: { select: { bookings: true } } },
      orderBy: { startsAt: 'asc' },
      take: 30,
    })
    const mine = principal.role === 'MEMBER'
      ? await prisma.classBooking.findMany({
          where: {
            memberId: principal.id,
            status: 'BOOKED',
            klass: { is: { gymId: principal.gymId } },
          },
          select: { classId: true },
        })
      : []
    const bookedIds = new Set(mine.map((b) => b.classId))
    return classes.map((c) => ({
      id: c.id,
      title: c.title,
      startsAt: c.startsAt.toISOString(),
      durationMinutes: c.durationMinutes,
      capacity: c.capacity,
      bookedCount: c._count.bookings,
      bookedByMe: bookedIds.has(c.id),
    }))
  })

  app.post('/api/classes/:id/book', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }
    const principal = getPrincipal(req)
    if (principal.role !== 'MEMBER') throw new DomainError('FORBIDDEN', 'Solo socios', 403)
    const gymClass = await prisma.gymClass.findFirst({ where: { id, gymId: principal.gymId } })
    if (!gymClass) throw new DomainError('NOT_FOUND', 'Clase no encontrada', 404)
    const member = await prisma.member.findFirst({
      where: { id: principal.id, deletedAt: null, ...activeMemberGymScope(principal.gymId) },
      select: { id: true },
    })
    if (!member) throw new DomainError('NO_GYM', 'No tienes una afiliación activa en este gimnasio', 403)
    const count = await prisma.classBooking.count({ where: { classId: id, status: 'BOOKED' } })
    if (count >= gymClass.capacity) throw new DomainError('CONFLICT', 'La clase está llena', 409)
    await prisma.classBooking.upsert({
      where: { classId_memberId: { classId: id, memberId: principal.id } },
      create: { classId: id, memberId: principal.id, status: 'BOOKED' },
      update: { status: 'BOOKED' },
    })
    return { ok: true, booked: true }
  })

  app.delete('/api/classes/:id/book', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }
    const principal = getPrincipal(req)
    await prisma.classBooking.updateMany({
      where: { classId: id, memberId: principal.id, klass: { is: { gymId: principal.gymId } } },
      data: { status: 'CANCELLED' },
    })
    return { ok: true, booked: false }
  })
}
