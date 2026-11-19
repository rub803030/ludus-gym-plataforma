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
  | 'DENIED_QR'
  | 'DENIED_CAPACITY'
  | 'DENIED_EXPIRED'

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
