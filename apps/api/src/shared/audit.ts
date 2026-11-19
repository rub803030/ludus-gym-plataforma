import { prisma } from './database/prisma.js'

export interface AuditInput {
  gymId: string
  actorId?: string | null
  actorRole?: string | null
  action: string
  entity: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  ip?: string | null
  userAgent?: string | null
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO audit_logs (gym_id, actor_id, actor_role, action, entity, entity_id, before, after, ip, user_agent)
      VALUES (
        ${input.gymId}::uuid,
        ${input.actorId ?? null}::uuid,
        ${input.actorRole ?? null},
        ${input.action},
        ${input.entity},
        ${input.entityId ?? null},
        ${input.before ? JSON.stringify(input.before) : null}::jsonb,
        ${input.after ? JSON.stringify(input.after) : null}::jsonb,
        ${input.ip ?? null}::inet,
        ${input.userAgent ?? null}
      )
    `
  } catch {
    // La auditoría nunca debe bloquear la operación principal.
  }
}
