/**
 * Crea (o rotaciona) el primer OWNER de una instalación nueva.
 *
 * Uso:
 *   pnpm --filter @ludus/api exec node scripts/create-owner.mjs \
 *     --email owner@tu-gym.com --password 'ContraseñaLarga123!' \
 *     --name 'Dueño' --gym-name 'Tu GYM'
 *
 * Añade --force para rotar la contraseña de un OWNER existente.
 * La contraseña NUNCA se escribe en logs ni en la base de datos en texto plano.
 */
import { randomBytes, scryptSync } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..')
for (const file of ['.env', 'apps/api/.env']) {
  const path = resolve(root, file)
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line)
    if (!match || process.env[match[1]] !== undefined) continue
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

const email = arg('email')?.toLowerCase()
const password = arg('password')
const name = arg('name')
const gymName = arg('gym-name')
const gymId = arg('gym-id')
const force = process.argv.includes('--force')

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Debes indicar --email válido')
if (!password || password.length < 8) fail('Debes indicar --password de al menos 8 caracteres')
if (!name || name.length < 2) fail('Debes indicar --name')
if (!gymId && !gymName) fail('Debes indicar --gym-id o --gym-name')
if (!process.env.DATABASE_URL) fail('Falta DATABASE_URL en el entorno o en .env')

const salt = randomBytes(16)
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
const passwordHash = `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`

const prisma = new PrismaClient()
try {
  let gym
  if (gymId) {
    gym = await prisma.gym.findUnique({ where: { id: gymId } })
    if (!gym) fail(`No existe el gimnasio ${gymId}`)
  } else {
    const slug = gymName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    gym = await prisma.gym.upsert({
      where: { slug },
      update: {},
      create: { name: gymName, slug, timezone: 'America/Mexico_City', capacity: 100, currency: 'MXN' },
    })
  }

  const existing = await prisma.staffUser.findUnique({ where: { gymId_email: { gymId: gym.id, email } } })
  if (existing && !force) {
    fail(`Ya existe ${email} en ese gimnasio. Usa --force para rotar su contraseña.`)
  }

  const owner = existing
    ? await prisma.staffUser.update({
        where: { id: existing.id },
        data: { passwordHash, role: 'OWNER', isActive: true, suspendedAt: null, deletedAt: null, emailVerified: true, emailVerifiedAt: new Date() },
      })
    : await prisma.staffUser.create({
        data: { gymId: gym.id, email, passwordHash, fullName: name, role: 'OWNER', isActive: true, emailVerified: true, emailVerifiedAt: new Date() },
      })

  console.log(`OWNER ${existing ? 'actualizado' : 'creado'}: ${owner.email}`)
  console.log(`Gimnasio: ${gym.name} (${gym.id})`)
  console.log('Contraseña configurada correctamente (no se muestra).')
} finally {
  await prisma.$disconnect()
}
