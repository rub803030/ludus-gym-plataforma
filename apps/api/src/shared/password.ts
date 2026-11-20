import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64
const SALT_LENGTH = 16
const PARAMS = { N: 16384, r: 8, p: 1 } as const

/** Contraseña temporal de 16 caracteres, sin caracteres ambiguos. */
export function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#'
  return Array.from({ length: 16 }, () => alphabet[randomInt(alphabet.length)]).join('')
}

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const hash = scryptSync(plain, salt, KEY_LENGTH, PARAMS)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  try {
    const expected = Buffer.from(hashHex, 'hex')
    const actual = scryptSync(plain, Buffer.from(saltHex, 'hex'), expected.length, PARAMS)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
