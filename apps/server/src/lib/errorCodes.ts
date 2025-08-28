// apps/server/src/lib/errorCodes.ts
/**
 * 에러코드와 HTTP 상태코드 중앙 매핑 시스템
 */

export interface ErrorMapping {
  code: string;
  httpStatus: number;
  message: string;
  category: "AUTH" | "VALIDATION" | "BUSINESS" | "SYSTEM" | "EXTERNAL";
}

/**
 * 표준 에러코드 매핑
 */
export const ERROR_MAPPINGS: Record<string, ErrorMapping> = {
  // === 인증 관련 (4xx) ===
  INVALID_CODE: {
    code: "INVALID_CODE",
    httpStatus: 401,
    message: "인증번호가 올바르지 않습니다",
    category: "AUTH",
  },
  EXPIRED: {
    code: "EXPIRED",
    httpStatus: 410,
    message: "인증번호가 만료되었습니다",
    category: "AUTH",
  },
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    httpStatus: 401,
    message: "인증이 필요합니다",
    category: "AUTH",
  },
  FORBIDDEN: {
    code: "FORBIDDEN",
    httpStatus: 403,
    message: "접근 권한이 없습니다",
    category: "AUTH",
  },
  TOKEN_EXPIRED: {
    code: "TOKEN_EXPIRED",
    httpStatus: 401,
    message: "토큰이 만료되었습니다",
    category: "AUTH",
  },

  // === 유효성 검증 (4xx) ===
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    httpStatus: 400,
    message: "입력값이 올바르지 않습니다",
    category: "VALIDATION",
  },
  MISSING_PARAMETER: {
    code: "MISSING_PARAMETER",
    httpStatus: 400,
    message: "필수 파라미터가 누락되었습니다",
    category: "VALIDATION",
  },
  INVALID_FORMAT: {
    code: "INVALID_FORMAT",
    httpStatus: 400,
    message: "형식이 올바르지 않습니다",
    category: "VALIDATION",
  },

  // === 비즈니스 로직 (4xx) ===
  RATE_LIMIT: {
    code: "RATE_LIMIT",
    httpStatus: 429,
    message: "요청 한도를 초과했습니다",
    category: "BUSINESS",
  },
  USER_NOT_FOUND: {
    code: "USER_NOT_FOUND",
    httpStatus: 404,
    message: "사용자를 찾을 수 없습니다",
    category: "BUSINESS",
  },
  DUPLICATE_USER: {
    code: "DUPLICATE_USER",
    httpStatus: 409,
    message: "이미 존재하는 사용자입니다",
    category: "BUSINESS",
  },
  INSUFFICIENT_BALANCE: {
    code: "INSUFFICIENT_BALANCE",
    httpStatus: 402,
    message: "잔액이 부족합니다",
    category: "BUSINESS",
  },

  // === KYC 관련 (4xx) ===
  KYC_AGE_RESTRICTION: {
    code: "KYC_AGE_RESTRICTION",
    httpStatus: 403,
    message: "연령 제한으로 이용할 수 없습니다 (50세 미만)",
    category: "BUSINESS",
  },
  KYC_INFO_MISMATCH: {
    code: "KYC_INFO_MISMATCH",
    httpStatus: 401,
    message: "신원정보가 일치하지 않습니다",
    category: "AUTH",
  },
  KYC_VERIFICATION_FAILED: {
    code: "KYC_VERIFICATION_FAILED",
    httpStatus: 422,
    message: "신원인증에 실패했습니다",
    category: "BUSINESS",
  },

  // === 시스템 에러 (5xx) ===
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    httpStatus: 500,
    message: "내부 서버 오류가 발생했습니다",
    category: "SYSTEM",
  },
  DATABASE_ERROR: {
    code: "DATABASE_ERROR",
    httpStatus: 500,
    message: "데이터베이스 오류가 발생했습니다",
    category: "SYSTEM",
  },
  SERVICE_UNAVAILABLE: {
    code: "SERVICE_UNAVAILABLE",
    httpStatus: 503,
    message: "서비스를 일시적으로 사용할 수 없습니다",
    category: "SYSTEM",
  },

  // === 외부 연동 에러 (5xx) ===
  EXTERNAL_API_ERROR: {
    code: "EXTERNAL_API_ERROR",
    httpStatus: 502,
    message: "외부 서비스 연동 오류가 발생했습니다",
    category: "EXTERNAL",
  },
  SMS_SEND_FAILED: {
    code: "SMS_SEND_FAILED",
    httpStatus: 502,
    message: "SMS 전송에 실패했습니다",
    category: "EXTERNAL",
  },
  KYC_API_TIMEOUT: {
    code: "KYC_API_TIMEOUT",
    httpStatus: 504,
    message: "KYC 서비스 응답 시간을 초과했습니다",
    category: "EXTERNAL",
  },
};

/**
 * 표준화된 에러 클래스
 */
export class StandardError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly category: string;
  public readonly data?: any;

  constructor(code: string, message?: string, data?: any) {
    const mapping = ERROR_MAPPINGS[code];
    if (!mapping) {
      // 매핑되지 않은 에러코드는 INTERNAL_ERROR로 처리
      super(message || "Unknown error");
      this.code = "INTERNAL_ERROR";
      this.httpStatus = 500;
      this.category = "SYSTEM";
    } else {
      super(message || mapping.message);
      this.code = mapping.code;
      this.httpStatus = mapping.httpStatus;
      this.category = mapping.category;
    }
    this.data = data;
    this.name = "StandardError";
  }

  /**
   * Express Response 형태로 변환
   */
  toResponse() {
    return {
      success: false,
      code: this.code,
      message: this.message,
      data: this.data || null,
    };
  }
}

/**
 * 에러코드에서 HTTP 상태코드를 가져오는 헬퍼 함수
 */
export function getHttpStatusFromCode(code: string): number {
  return ERROR_MAPPINGS[code]?.httpStatus || 500;
}

/**
 * 에러 생성 헬퍼 함수들
 */
export const createError = {
  invalidCode: (message?: string) => new StandardError("INVALID_CODE", message),
  expired: (message?: string) => new StandardError("EXPIRED", message),
  rateLimit: (message?: string) => new StandardError("RATE_LIMIT", message),
  unauthorized: (message?: string) => new StandardError("UNAUTHORIZED", message),
  userNotFound: (message?: string) => new StandardError("USER_NOT_FOUND", message),
  duplicateUser: (message?: string) => new StandardError("DUPLICATE_USER", message),
  missingParameter: (message?: string) => new StandardError("MISSING_PARAMETER", message),
  invalidFormat: (message?: string) => new StandardError("INVALID_FORMAT", message),
  validationError: (message?: string) => new StandardError("VALIDATION_ERROR", message),
  kycAgeFailed: (age: number) =>
    new StandardError("KYC_AGE_RESTRICTION", `연령 제한: ${age}세는 서비스 이용이 불가합니다`),
  kycMismatch: (message?: string) => new StandardError("KYC_INFO_MISMATCH", message),
  kycVerificationFailed: (message?: string) =>
    new StandardError("KYC_VERIFICATION_FAILED", message),
  internalError: (message?: string, data?: any) =>
    new StandardError("INTERNAL_ERROR", message, data),
  externalApiError: (service: string, error?: any) =>
    new StandardError("EXTERNAL_API_ERROR", `${service} 연동 실패`, error),
};
