import type { FastifyInstance } from 'fastify'
import { prisma } from '../../shared/database/prisma.js'
import { writeAudit } from '../../shared/audit.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { requireAuth } from '../../shared/http.js'
import { getPrincipal } from '../../shared/middleware/request-context.js'
import { requireAdmin } from '../../shared/middleware/rbac.js'
import { verificationResponse } from '../auth/email-verification.js'
import { issueGymApproval } from '../gyms/gym-verification.js'

/** Consola global: lista de gimnasios esperando autorización. */
export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/gyms/pending', { preHandler: [requireAuth, requireAdmin] }, async () => {
    const gyms = await prisma.gym.findMany({
      where: { status: 'PENDING_VERIFICATION', deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
        contactEmail: true,
        phone: true,
        legalRepresentative: true,
        rfc: true,
        website: true,
        socialMedia: true,
        description: true,
        branchCount: true,
        openingHours: true,
        createdAt: true,
      },
    })
    return { gyms }
  })

  app.post('/api/admin/gyms/:id/approve', { preHandler: [requireAuth, requireAdmin] }, async (req) => {
    const principal = getPrincipal(req)
    const { id } = req.params as { id: string }
    const gym = await prisma.gym.findFirst({ where: { id, deletedAt: null } })
    if (!gym) throw new DomainError('NOT_FOUND', 'Gimnasio no encontrado', 404)
    if (gym.status === 'ACTIVE') {
      throw new DomainError('CONFLICT', 'Este gimnasio ya está autorizado', 409)
    }
    const owner = await prisma.staffUser.findFirst({
      where: { gymId: gym.id, role: 'OWNER', deletedAt: null },
      select: { emailVerified: true },
    })
    if (!owner?.emailVerified) {
      throw new DomainError('OWNER_EMAIL_NOT_VERIFIED', 'El propietario debe confirmar su correo antes de autorizar el gimnasio', 409)
    }
    const approval = await issueGymApproval(gym.id, gym.name)
    await writeAudit({
      gymId: gym.id,
      actorId: principal.id,
      actorRole: 'ADMIN',
      action: 'gym.approval.sent',
      entity: 'gym',
      entityId: gym.id,
    })
    return { gym: { id: gym.id, name: gym.name, status: gym.status }, approval: verificationResponse(approval) }
  })
}
