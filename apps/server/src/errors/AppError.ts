export class AppError extends Error {
  constructor(
    public code: string, 
    public status: number = 400, 
    message?: string, 
    public data?: any
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}

// 표준 에러 코드들
export const ErrorCodes = {
  // 검증 에러
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // SMS 관련 에러
  SMS_SEND_FAILED: 'SMS_SEND_FAILED',
  SMS_RESEND_BLOCKED: 'SMS_RESEND_BLOCKED',
  
  // OTP 인증 에러
  AUTH_OTP_INVALID: 'AUTH_OTP_INVALID',
  AUTH_OTP_EXPIRED: 'AUTH_OTP_EXPIRED',
  AUTH_OTP_TOO_MANY_ATTEMPTS: 'AUTH_OTP_TOO_MANY_ATTEMPTS',
  
  // 레이트 리밋
  RATE_LIMITED: 'RATE_LIMITED',
  
  // 회원가입 관련 에러
  PHONE_NOT_FOUND: 'PHONE_NOT_FOUND',
  REG_TICKET_NOT_FOUND: 'REG_TICKET_NOT_FOUND',
  TERMS_REQUIRED: 'TERMS_REQUIRED',
  AGE_RESTRICTION: 'AGE_RESTRICTION',
  NICKNAME_TAKEN: 'NICKNAME_TAKEN',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  
  // 시스템 에러
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
