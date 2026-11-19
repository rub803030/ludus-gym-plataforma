import type { FastifyRequest } from 'fastify'
import type { Principal } from '@ludus/shared'
import type { AccessClaims } from '../jwt.js'

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal
    claims?: AccessClaims
    idempotencyKey?: string
  }
}

export function getPrincipal(req: FastifyRequest): Principal {
  if (!req.principal) {
    throw new Error('Principal ausente: la ruta no aplicó autenticación')
  }
  return req.principal
}
