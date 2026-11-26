import { z } from 'zod'

/** Alta pública de un gimnasio junto con la cuenta OWNER. */
export const registerGymSchema = z.object({
  gymName: z.string().min(2).max(120),
  slug: z.string().min(3).max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  ownerName: z.string().min(2).max(120),
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
  contactEmail: z.string().email().max(255),
  phone: z.string().min(8).max(40),
  address: z.string().min(5).max(200),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  postalCode: z.string().min(4).max(12),
  legalRepresentative: z.string().min(2).max(120),
  rfc: z.string().min(12).max(13),
  website: z.string().url().max(500).optional(),
  socialMedia: z.string().max(300).optional(),
  description: z.string().max(1000).optional(),
  branchCount: z.number().int().min(1).max(1000).default(1),
  timezone: z.string().max(64).default('America/Mexico_City'),
  capacity: z.number().int().min(1).max(100000).default(20),
  currency: z.literal('MXN').default('MXN'),
  openingHours: z.string().max(200).optional(),
})

export const verifyGymSchema = z.object({
  token: z.string().min(20).max(300),
})

/** Autorización global: el enlace de un solo uso llega al correo del ADMIN. */
export const approveGymSchema = z.object({
  token: z.string().min(20).max(300),
})

/** Edición del perfil por el dueño del tenant. */
export const gymProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  address: z.string().max(200).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  state: z.string().max(80).nullable().optional(),
  postalCode: z.string().max(12).nullable().optional(),
  contactEmail: z.string().email().max(255).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  legalRepresentative: z.string().max(120).nullable().optional(),
  rfc: z.string().max(13).nullable().optional(),
  website: z.string().url().max(500).nullable().optional(),
  socialMedia: z.string().max(300).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  branchCount: z.number().int().min(1).max(1000).optional(),
  openingHours: z.string().max(200).nullable().optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  timezone: z.string().max(64).optional(),
  capacity: z.number().int().min(1).max(100000).optional(),
  currency: z.literal('MXN').optional(),
}).refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: 'Envía al menos un campo para actualizar',
})

/** Acepta el código corto LUDUS-XXXX o el QR estático completo. */
export const joinGymSchema = z.object({
  code: z.string().min(4).max(500),
})

/** Registro global del socio: no requiere gimnasio previo. */
export const registerMemberSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
  phone: z.string().min(8).max(24).optional(),
  documentNumber: z.string().min(5).max(32).optional(),
  birthDate: z.string().date().optional(),
})

export type RegisterGymInput = z.infer<typeof registerGymSchema>
export type VerifyGymInput = z.infer<typeof verifyGymSchema>
export type ApproveGymInput = z.infer<typeof approveGymSchema>
export type GymProfileInput = z.infer<typeof gymProfileSchema>
export type JoinGymInput = z.infer<typeof joinGymSchema>
export type RegisterMemberInput = z.infer<typeof registerMemberSchema>
