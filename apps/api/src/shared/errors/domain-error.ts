export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'IDEMPOTENCY_REPLAY'
  | 'MEMBERSHIP_EXPIRED'
  | 'QR_REPLAY'
  | 'RATE_LIMITED'
  | 'EMAIL_NOT_VERIFIED'
  | 'VERIFICATION_TOKEN_INVALID'
  | 'VERIFICATION_TOKEN_EXPIRED'
  | 'DENIED_QR'
  | 'DENIED_CAPACITY'
  | 'DENIED_EXPIRED'
  | 'NO_GYM'
  | 'GYM_NOT_ACTIVE'
  | 'CROSS_GYM_PASS'
  | 'INVALID_ENROLLMENT_CODE'
  | 'ADMIN_NOT_CONFIGURED'

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}
