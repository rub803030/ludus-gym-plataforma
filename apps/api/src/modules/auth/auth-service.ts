import { createHash } from 'node:crypto'
import { prisma } from '../../shared/database/prisma.js'
import { hashPassword, verifyPassword } from '../../shared/password.js'
import {
  issueAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
} from '../../shared/jwt.js'
import { getCache } from '../../shared/redis.js'
import { DomainError } from '../../shared/errors/domain-error.js'
import { encryptField } from '../../shared/crypto.js'
import type { Role } from '@ludus/shared'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Gimnasio activo del socio: primero sus membresías, luego el campo legacy. */
async function memberGymContext(
  memberId: string,
  legacyGymId: string | null,
): Promise<{ gymId: string; activeGymId: string | null }> {
  const links = await prisma.gymMembership.findMany({
    where: {
      memberId,
      isActive: true,
      status: 'ACTIVE',
      deletedAt: null,
      gym: { status: 'ACTIVE', deletedAt: null },
    },
    select: { gymId: true },
    orderBy: { joinedAt: 'asc' },
  })
  const chosen = links[0]?.gymId ?? legacyGymId ?? null
  return { gymId: chosen ?? '', activeGymId: chosen }
}

export interface LoginResult {
  accessToken: string
  refreshToken: string
  csrfToken: string
  principal: {
    id: string
    role: Role
    platform: 'web' | 'mobile'
    gymId: string
    activeGymId: string | null
    name: string
  }
}

/** Emite una sesión móvil ya vinculada al gimnasio indicado. */
export async function issueMemberSession(
  memberId: string,
  gymId: string,
  deviceId: string,
): Promise<LoginResult> {
  const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } })
  if (!member) throw new DomainError('NOT_FOUND', 'Socio no encontrado', 404)
  const input = {
    sub: member.id,
    role: 'MEMBER' as const,
    platform: 'mobile' as const,
    gymId,
    activeGymId: gymId,
  }
  const access = issueAccessToken(input)
  const refresh = issueRefreshToken(input)
  await prisma.memberSession.create({
    data: {
      memberId: member.id,
      jti: refresh.claims.jti,
      tokenHash: hashToken(refresh.token),
      deviceId,
      expiresAt: new Date(refresh.claims.exp * 1000),
    },
  })
  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    csrfToken: '',
    principal: {
      id: member.id,
      role: 'MEMBER',
      platform: 'mobile',
      gymId,
      activeGymId: gymId,
      name: `${member.firstName} ${member.lastName}`,
    },
  }
}

export async function loginWeb(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.staffUser.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
  })
  if (!user) {
    const member = await prisma.member.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { passwordHash: true },
    })
    if (member?.passwordHash && verifyPassword(password, member.passwordHash)) {
      throw new DomainError('FORBIDDEN', 'La consola web es exclusiva del equipo. Usa la app móvil', 403)
    }
    throw new DomainError('UNAUTHORIZED', 'Correo o contraseña incorrectos', 401)
  }
  if (!verifyPassword(password, user.passwordHash)) {
    throw new DomainError('UNAUTHORIZED', 'Correo o contraseña incorrectos', 401)
  }
  if (!user.emailVerified) {
    throw new DomainError('EMAIL_NOT_VERIFIED', 'Verifica tu correo para entrar a la consola', 403, { email: user.email })
  }
  if (!user.isActive || user.suspendedAt) {
    throw new DomainError('FORBIDDEN', 'Esta licencia está suspendida. Contacta al dueño', 403)
  }
  if (String(user.role) === 'MEMBER') {
    throw new DomainError('FORBIDDEN', 'La consola web es exclusiva del equipo', 403)
  }

  const input = { sub: user.id, role: user.role as Role, platform: 'web' as const, gymId: user.gymId }
  const access = issueAccessToken(input)
  const refresh = issueRefreshToken(input)
  await prisma.refreshToken.create({
    data: {
      staffId: user.id,
      jti: refresh.claims.jti,
      tokenHash: hashToken(refresh.token),
      familyId: refresh.claims.familyId!,
      expiresAt: new Date(refresh.claims.exp * 1000),
    },
  })
  await prisma.staffUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    csrfToken: '',
    principal: {
      id: user.id,
      role: input.role,
      platform: 'web',
      gymId: user.gymId,
      activeGymId: user.gymId,
      name: user.fullName,
    },
  }
}

export async function loginMember(email: string, password: string, deviceId: string): Promise<LoginResult> {
  const member = await prisma.member.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
  })
  if (!member?.passwordHash || !verifyPassword(password, member.passwordHash)) {
    throw new DomainError('UNAUTHORIZED', 'Correo o contraseña incorrectos', 401)
  }
  if (!member.emailVerified) {
    throw new DomainError('EMAIL_NOT_VERIFIED', 'Verifica tu correo para usar la app', 403, { email: member.email })
  }
  if (member.status === 'SUSPENDED') {
    throw new DomainError('FORBIDDEN', 'Tu membresía está suspendida. Contacta recepción', 403)
  }

  const context = await memberGymContext(member.id, member.gymId)
  return issueMemberSession(member.id, context.gymId, deviceId)
}

export async function rotateRefresh(refreshToken: string): Promise<LoginResult> {
  const claims = verifyRefreshToken(refreshToken)
  const tokenHash = hashToken(refreshToken)

  const staffToken = claims.role !== 'MEMBER'
    ? await prisma.refreshToken.findUnique({ where: { jti: claims.jti } })
    : null
  if (staffToken) {
    if (staffToken.revokedAt) {
      throw new DomainError('UNAUTHORIZED', 'Sesión revocada', 401)
    }
    if (staffToken.usedAt) {
      await prisma.refreshToken.updateMany({
        where: { familyId: staffToken.familyId },
        data: { revokedAt: new Date() },
      })
      throw new DomainError('UNAUTHORIZED', 'Reuso de refresh detectado. Sesión cerrada', 401)
    }
    const user = await prisma.staffUser.findUnique({ where: { id: staffToken.staffId } })
    if (!user || !user.isActive || user.suspendedAt) {
      throw new DomainError('UNAUTHORIZED', 'Licencia suspendida', 401)
    }
    if (!user.emailVerified) {
      throw new DomainError('EMAIL_NOT_VERIFIED', 'Verifica tu correo para continuar', 403, { email: user.email })
    }
    await prisma.refreshToken.update({ where: { id: staffToken.id }, data: { usedAt: new Date() } })
    const input = { sub: user.id, role: user.role as Role, platform: claims.platform, gymId: user.gymId }
    const access = issueAccessToken(input)
    const refresh = issueRefreshToken({ ...input, familyId: staffToken.familyId })
    await prisma.refreshToken.create({
      data: {
        staffId: user.id,
        jti: refresh.claims.jti,
        tokenHash: hashToken(refresh.token),
        familyId: staffToken.familyId,
        expiresAt: new Date(refresh.claims.exp * 1000),
      },
    })
    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      csrfToken: '',
      principal: {
        id: user.id,
        role: input.role,
        platform: input.platform,
        gymId: user.gymId,
        activeGymId: user.gymId,
        name: user.fullName,
      },
    }
  }

  const memberSession = claims.role === 'MEMBER'
    ? await prisma.memberSession.findUnique({ where: { jti: claims.jti } })
    : null
  if (!memberSession) throw new DomainError('UNAUTHORIZED', 'Sesión no encontrada', 401)
  if (memberSession.revokedAt) throw new DomainError('UNAUTHORIZED', 'Sesión revocada', 401)
  if (memberSession.tokenHash !== tokenHash) {
    throw new DomainError('UNAUTHORIZED', 'Reuso de refresh detectado', 401)
  }
  const member = await prisma.member.findUnique({ where: { id: memberSession.memberId } })
  if (!member) throw new DomainError('UNAUTHORIZED', 'Socio no encontrado', 401)
  if (!member.emailVerified) {
    throw new DomainError('EMAIL_NOT_VERIFIED', 'Verifica tu correo para continuar', 403, { email: member.email })
  }
  await prisma.memberSession.update({ where: { id: memberSession.id }, data: { tokenHash: hashToken('used') } })
  const context = await memberGymContext(member.id, member.gymId)
  const input = {
    sub: member.id,
    role: 'MEMBER' as const,
    platform: 'mobile' as const,
    ...context,
  }
  const access = issueAccessToken(input)
  const refresh = issueRefreshToken(input)
  await prisma.memberSession.create({
    data: {
      memberId: member.id,
      jti: refresh.claims.jti,
      tokenHash: hashToken(refresh.token),
      deviceId: memberSession.deviceId,
      expiresAt: new Date(refresh.claims.exp * 1000),
    },
  })
  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    csrfToken: '',
    principal: {
      id: member.id,
      role: input.role,
      platform: input.platform,
      gymId: context.gymId,
      activeGymId: context.activeGymId,
      name: `${member.firstName} ${member.lastName}`,
    },
  }
}

export async function logout(jti: string, id: string): Promise<void> {
  await getCache().set(`revoked:jti:${jti}`, '1', 'EX', 7 * 24 * 3600)
  await getCache().set(`revoked:user:${id}`, '1', 'EX', 15 * 60)
  await prisma.refreshToken.updateMany({
    where: { staffId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  await prisma.memberSession.updateMany({
    where: { memberId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function revokeUser(id: string): Promise<void> {
  await getCache().set(`revoked:user:${id}`, '1', 'EX', 7 * 24 * 3600)
  await prisma.refreshToken.updateMany({ where: { staffId: id }, data: { revokedAt: new Date() } })
}

export async function changeStaffRole(id: string, role: Role): Promise<void> {
  await prisma.staffUser.update({ where: { id }, data: { role: role as never } })
  await revokeUser(id)
}

export async function createStaff(input: {
  gymId: string
  email: string
  password: string
  fullName: string
  role: Role
}): Promise<{ id: string; email: string; fullName: string }> {
  const staff = await prisma.staffUser.create({
    data: {
      gymId: input.gymId,
      email: input.email.toLowerCase(),
      passwordHash: hashPassword(input.password),
      fullName: input.fullName,
      role: input.role as never,
      emailVerified: false,
    },
  })
  return { id: staff.id, email: staff.email, fullName: staff.fullName }
}

export async function suspendStaff(id: string, suspended: boolean): Promise<void> {
  await prisma.staffUser.update({ where: { id }, data: { isActive: !suspended, suspendedAt: suspended ? new Date() : null } })
  if (suspended) await revokeUser(id)
}

export function encryptMedical(value: string | undefined): Buffer | null {
  return value ? encryptField(value) : null
}
