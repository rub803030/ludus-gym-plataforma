import type { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

export function inTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, { isolationLevel: 'Serializable' })
}