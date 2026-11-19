import type { Member, Membership } from '@prisma/client'
import { decryptField } from '../../../shared/crypto.js'

export interface MemberDto {
  id: string
  gymId: string
  code: string
  firstName: string
  lastName: string
  email: string
  phone: string
  documentType: string
  documentNumber: string
  birthDate: string
  status: string
  joinedAt: string
}

export interface MembershipSummary {
  status: string
  endDate: string | null
  daysRemaining: number
}

export interface MedicalRecord {
  medicalNotes: string | null
  allergies: string | null
  conditions: string | null
}

export function toMemberDto(member: Member): MemberDto {
  return {
    id: member.id,
    gymId: member.gymId,
    code: member.code,
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    phone: member.phone,
    documentType: member.documentType,
    documentNumber: member.documentNumber,
    birthDate: member.birthDate.toISOString().slice(0, 10),
    status: member.status,
    joinedAt: member.joinedAt.toISOString(),
  }
}

export function toMembershipSummary(membership: Membership | null): MembershipSummary | null {
  if (!membership) return null
  const endDate = membership.endDate ? membership.endDate.toISOString().slice(0, 10) : null
  const daysRemaining = membership.endDate
    ? Math.max(0, Math.ceil((membership.endDate.getTime() - Date.now()) / 86_400_000))
    : 0
  return { status: membership.status, endDate, daysRemaining }
}

function decode(value: Uint8Array | null): string | null {
  if (!value) return null
  return decryptField(Buffer.isBuffer(value) ? value : Buffer.from(value))
}

export function toMedicalRecord(member: Member): MedicalRecord {
  return {
    medicalNotes: decode(member.medicalNotesCipher),
    allergies: decode(member.allergiesCipher),
    conditions: decode(member.conditionsCipher),
  }
}
