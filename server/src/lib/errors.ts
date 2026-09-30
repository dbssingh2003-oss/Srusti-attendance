export type ErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'INVALID_OR_EXPIRED_CODE'
  | 'CHECKIN_WINDOW_CLOSED'
  | 'NOT_ENROLLED'
  | 'ALREADY_MARKED'
  | 'RATE_LIMITED'
  | 'SESSION_LOCKED'
  | 'WINDOW_ALREADY_EXTENDED'
  | 'INVALID_STATE_TRANSITION'
  | 'NOT_FOUND'
  | 'MUST_CHANGE_PASSWORD'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(code: ErrorCode, statusCode: number, message?: string) {
    super(message ?? code);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Check if an error is a Prisma unique constraint violation.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

/**
 * Check if an error is a Prisma record not found error.
 */
export function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2025'
  );
}
