import { configureSpanishZodErrors } from './i18n/zod-es.js'

configureSpanishZodErrors()

export * from './i18n/zod-es.js'
export * from './constants/roles.js'
export * from './constants/permissions.js'
export * from './schemas/auth.js'
export * from './schemas/member.js'
export * from './schemas/payment.js'
export * from './schemas/access.js'
export * from './types/index.js'