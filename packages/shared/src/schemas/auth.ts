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

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(200),
})

export const resendVerificationSchema = z.object({
  email: z.string().email().max(255),
  platform: z.enum(['web', 'mobile']).default('web'),
})

export type WebLogin = z.infer<typeof webLoginSchema>
export type MobileLogin = z.infer<typeof mobileLoginSchema>
export type VerifyEmail = z.infer<typeof verifyEmailSchema>
export type ResendVerification = z.infer<typeof resendVerificationSchema>