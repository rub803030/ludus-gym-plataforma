import type { FastifyReply, FastifyRequest } from 'fastify'
import { DomainError } from '../errors/domain-error.js'

export async function idempotencyGuard(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const key = req.headers['idempotency-key']
  if (typeof key !== 'string' || key.length < 16 || key.length > 128) {
    throw new DomainError('VALIDATION_ERROR', 'Idempotency-Key requerido (16-128 caracteres)', 400)
  }
  req.idempotencyKey = key
}
