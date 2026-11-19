import { z } from 'zod'

export const createMemberSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  email: z.string().email().max(255),
  document: z.string().min(6).max(32),
  phone: z.string().min(8).max(24),
  birthDate: z.string().date(),
  medicalNotes: z.string().max(2000).optional(),
})

export type CreateMemberInput = z.infer<typeof createMemberSchema>