import { z } from 'zod'

export const webLoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  platform: z.literal('web'),
})

export const mobileLoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  platform: z.literal('mobile'),
})

export type WebLogin = z.infer<typeof webLoginSchema>
export type MobileLogin = z.infer<typeof mobileLoginSchema>