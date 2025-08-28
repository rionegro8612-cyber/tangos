import crypto from "crypto";

// ===== 민감정보 키 상수 정의 🆕 추가 =====
export const SENSITIVE_KEYS = [
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "key",
  "api_key",
  "apikey",
  "auth",
  "authorization",
  "cookie",
  "session",
  "jwt",
  "access_token",
  "refresh_token",
  "credit_card",
  "card_number",
  "cvv",
  "ssn",
  "resident_number",
  "phone",
  "email",
  "address",
  "zip",
  "postal",
  "city",
  "state",
  "country",
];

// ===== PII 마스킹 함수들 =====

/**
 * 전화번호 마스킹: +82****####
 * 예: +821012345678 → +82****5678
 */
export function maskPhone(phone: string): string {
  if (!phone || typeof phone !== "string") return "[REDACTED]";

  // +82로 시작하는 한국 전화번호
  if (phone.startsWith("+82")) {
    const prefix = phone.substring(0, 3); // +82
    const middle = "****";
    const suffix = phone.substring(phone.length - 4); // 마지막 4자리

    return `${prefix}${middle}${suffix}`;
  }

  // 다른 형식의 전화번호
  if (phone.length >= 8) {
    const prefix = phone.substring(0, 2);
    const middle = "****";
    const suffix = phone.substring(phone.length - 4);

    return `${prefix}${middle}${suffix}`;
  }

  return "[REDACTED]";
}

/**
 * 이메일 마스킹: a***@b***.com
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "[REDACTED]";

  const [local, domain] = email.split("@");
  if (!domain) return "[REDACTED]";

  const maskedLocal = local.length > 1 ? `${local[0]}***` : "***";
  const [domainName, tld] = domain.split(".");
  const maskedDomain = domainName.length > 1 ? `${domainName[0]}***` : "***";

  return `${maskedLocal}@${maskedDomain}.${tld}`;
}

/**
 * 이름 마스킹: 김***, 홍***
 */
export function maskName(name: string): string {
  if (!name || typeof name !== "string") return "[REDACTED]";

  if (name.length <= 1) return "***";
  if (name.length === 2) return `${name[0]}***`;

  return `${name[0]}***`;
}

/**
 * 주민등록번호 마스킹: 123456-*******
 */
export function maskResidentNumber(rn: string): string {
  if (!rn || typeof rn !== "string") return "[REDACTED]";

  const cleaned = rn.replace(/[^0-9]/g, "");
  if (cleaned.length !== 13) return "[REDACTED]";

  return `${cleaned.substring(0, 6)}-*******`;
}

/**
 * 신용카드 번호 마스킹: 1234-****-****-5678
 */
export function maskCreditCard(card: string): string {
  if (!card || typeof card !== "string") return "[REDACTED]";

  const cleaned = card.replace(/[^0-9]/g, "");
  if (cleaned.length < 13 || cleaned.length > 19) return "[REDACTED]";

  const prefix = cleaned.substring(0, 4);
  const suffix = cleaned.substring(cleaned.length - 4);
  const middle = "*".repeat(cleaned.length - 8);

  return `${prefix}-${middle}-${middle}-${suffix}`;
}

// ===== 민감정보 제거 함수들 =====

/**
 * 객체에서 민감한 키들을 제거하거나 마스킹
 */
export function sanitizeObject(obj: any, sensitiveKeys: string[] = []): any {
  if (!obj || typeof obj !== "object") return obj;

  // 🆕 SENSITIVE_KEYS 상수 사용
  const allSensitiveKeys = [...new Set([...SENSITIVE_KEYS, ...sensitiveKeys])];

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, allSensitiveKeys));
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = allSensitiveKeys.some(
      (sensitive) => lowerKey.includes(sensitive) || sensitive.includes(lowerKey),
    );

    if (isSensitive) {
      // 민감한 키는 마스킹하거나 제거
      if (lowerKey.includes("phone")) {
        sanitized[key] = maskPhone(value as string);
      } else if (lowerKey.includes("email")) {
        sanitized[key] = maskEmail(value as string);
      } else if (lowerKey.includes("name")) {
        sanitized[key] = maskName(value as string);
      } else {
        sanitized[key] = "[REDACTED]";
      }
    } else if (typeof value === "object" && value !== null) {
      // 중첩된 객체는 재귀적으로 처리
      sanitized[key] = sanitizeObject(value, allSensitiveKeys);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * HTTP 요청/응답 본문에서 민감정보 제거
 * JSON 문자열과 객체 모두 처리
 */
export function sanitizeHttpBody(body: any): any {
  if (!body) return body;

  // JSON 문자열인 경우 파싱 후 처리
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return sanitizeObject(parsed, SENSITIVE_KEYS);
    } catch {
      // JSON 파싱 실패 시 문자열 그대로 반환 (민감정보 패턴 검사)
      return sanitizeLogMessage(body);
    }
  }

  // 객체인 경우 직접 처리
  if (typeof body === "object") {
    return sanitizeObject(body, SENSITIVE_KEYS);
  }

  return body;
}

/**
 * 에러 객체에서 민감정보 제거 (스택 트레이스는 유지)
 */
export function sanitizeError(error: any): any {
  if (!error || typeof error !== "object") return error;

  const sanitized: any = {
    name: error.name,
    message: error.message,
    stack: error.stack, // 스택 트레이스는 유지
    code: error.code,
    status: error.status,
    statusCode: error.statusCode,
  };

  // 추가 속성들도 민감정보 제거
  for (const [key, value] of Object.entries(error)) {
    if (!["name", "message", "stack", "code", "status", "statusCode"].includes(key)) {
      if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

// ===== 로그 샘플링 함수들 =====

/**
 * 로그 레벨별 샘플링 비율 설정
 */
export const LOG_SAMPLING_RATES = {
  error: 1.0, // 100%: 모든 에러 로그
  warn: 1.0, // 100%: 모든 경고 로그
  info: 0.1, // 10%: 정보 로그
  debug: 0.01, // 1%: 디버그 로그
  trace: 0.001, // 0.1%: 트레이스 로그
};

/**
 * 로그 레벨별 샘플링 결정
 */
export function shouldLog(level: keyof typeof LOG_SAMPLING_RATES): boolean {
  const rate = LOG_SAMPLING_RATES[level] || 1.0;
  return Math.random() < rate;
}

/**
 * 로그 샘플링 헬퍼 (환경변수로 제어)
 */
export function getLogSamplingRate(level: string): number {
  const envKey = `LOG_SAMPLE_${level.toUpperCase()}`;
  const envRate = process.env[envKey];

  if (envRate) {
    const rate = parseFloat(envRate);
    return isNaN(rate) ? LOG_SAMPLING_RATES[level as keyof typeof LOG_SAMPLING_RATES] || 1.0 : rate;
  }

  return LOG_SAMPLING_RATES[level as keyof typeof LOG_SAMPLING_RATES] || 1.0;
}

/**
 * 환경변수 기반 로그 샘플링
 */
export function shouldLogWithEnv(level: string): boolean {
  const rate = getLogSamplingRate(level);
  return Math.random() < rate;
}

// ===== 보안 헬퍼 함수들 =====

/**
 * 민감한 헤더 제거
 */
export function sanitizeHeaders(headers: any): any {
  if (!headers || typeof headers !== "object") return headers;

  const sensitiveHeaders = [
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
    "x-session-id",
    "x-csrf-token",
    "x-xsrf-token",
  ];

  const sanitized: any = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveHeaders.some(
      (sensitive) => lowerKey.includes(sensitive) || sensitive.includes(lowerKey),
    );

    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * URL에서 쿼리 파라미터 민감정보 제거
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") return url;

  try {
    const urlObj = new URL(url);
    const sensitiveParams = ["token", "key", "auth", "password", "secret", "api_key"];

    for (const param of sensitiveParams) {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, "[REDACTED]");
      }
    }

    return urlObj.toString();
  } catch {
    return url; // URL 파싱 실패 시 원본 반환
  }
}

/**
 * 로그 메시지에서 민감정보 패턴 제거
 */
export function sanitizeLogMessage(message: string): string {
  if (!message || typeof message !== "string") return message;

  // 전화번호 패턴 마스킹
  message = message.replace(/(\+82[0-9]{9,})/g, (match) => maskPhone(match));

  // 이메일 패턴 마스킹
  message = message.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match) =>
    maskEmail(match),
  );

  // 주민등록번호 패턴 마스킹
  message = message.replace(/([0-9]{6}-[0-9]{7})/g, (match) => maskResidentNumber(match));

  // 신용카드 패턴 마스킹
  message = message.replace(/([0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4})/g, (match) =>
    maskCreditCard(match),
  );

  return message;
}

// ===== 보안 설정 상태 확인 =====

export function getSecurityStatus() {
  return {
    phoneMasking: true,
    emailMasking: true,
    nameMasking: true,
    sensitiveKeyRemoval: true,
    errorStackPreservation: true,
    logSampling: {
      error: LOG_SAMPLING_RATES.error,
      warn: LOG_SAMPLING_RATES.warn,
      info: LOG_SAMPLING_RATES.info,
      debug: LOG_SAMPLING_RATES.debug,
      trace: LOG_SAMPLING_RATES.trace,
    },
    environment: process.env.NODE_ENV || "development",
  };
}
