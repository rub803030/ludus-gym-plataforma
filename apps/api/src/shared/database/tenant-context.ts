import type { Prisma } from '@prisma/client'

export async function setTenantContext(tx: Prisma.TransactionClient, gymId: string): Promise<void> {
  await tx.$queryRaw`SELECT set_config('app.gym_id', ${gymId}, true)`
}
