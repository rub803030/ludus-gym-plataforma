import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto'
import type { Role } from '@ludus/shared'
import { DomainError } from './errors/domain-error.js'

export type AccessClaims = TokenClaims

export interface TokenClaims {
  sub: string
  role: Role
  platform: 'web' | 'mobile'
  jti: string
  gymId: string
  type: 'access' | 'refresh'
  familyId?: string
  exp: number
  iat: number
}

function secret(type: 'access' | 'refresh'): string {
  const value = type === 'access' ? process.env.JWT_ACCESS_SECRET : process.env.JWT_REFRESH_SECRET
  if (!value || value.length < 32) throw new Error(`Secreto JWT ${type} inválido`)
  return value
}

function encode(claims: TokenClaims): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const signature = createHmac('sha256', secret(claims.type)).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}

function decode(token: string, type: 'access' | 'refresh'): TokenClaims {
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) throw new DomainError('UNAUTHORIZED', 'Token malformado', 401)
  const expected = createHmac('sha256', secret(type)).update(`${header}.${payload}`).digest('base64url')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new DomainError('UNAUTHORIZED', 'Firma inválida', 401)
  }
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenClaims
  if (claims.exp * 1000 < Date.now()) throw new DomainError('UNAUTHORIZED', 'Sesión expirada', 401)
  if (claims.type !== type) throw new DomainError('UNAUTHORIZED', 'Tipo de token inválido', 401)
  return claims
}

export function issueAccessToken(input: {
  sub: string
  role: Role
  platform: 'web' | 'mobile'
  gymId: string
}): { token: string; claims: TokenClaims } {
  const now = Math.floor(Date.now() / 1000)
  const claims: TokenClaims = {
    ...input,
    jti: randomUUID(),
    type: 'access',
    iat: now,
    exp: now + 15 * 60,
  }
  return { token: encode(claims), claims }
}

export function issueRefreshToken(input: {
  sub: string
  role: Role
  platform: 'web' | 'mobile'
  gymId: string
  familyId?: string
}): { token: string; claims: TokenClaims } {
  const now = Math.floor(Date.now() / 1000)
  const claims: TokenClaims = {
    ...input,
    jti: randomUUID(),
    type: 'refresh',
    familyId: input.familyId ?? randomUUID(),
    iat: now,
    exp: now + 7 * 24 * 60 * 60,
  }
  return { token: encode(claims), claims }
}

export function verifyAccessToken(token: string): TokenClaims {
  return decode(token, 'access')
}

export function verifyRefreshToken(token: string): TokenClaims {
  return decode(token, 'refresh')
}
