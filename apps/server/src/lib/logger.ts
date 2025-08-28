import pino from "pino";
import crypto from "crypto";
import { context, trace } from "@opentelemetry/api";
import {
  maskPhone,
  sanitizeObject,
  sanitizeError,
  sanitizeHeaders,
  sanitizeUrl,
  sanitizeLogMessage,
  sanitizeHttpBody, // 🆕 추가: HTTP 본문 민감정보 제거
  shouldLogWithEnv,
  getSecurityStatus,
} from "./security";

// 🆕 Audit 로그 통합
import {
  logUserRegistration as auditLogUserRegistration,
  logUserLogin as auditLogUserLogin,
  logProfileUpdate as auditLogProfileUpdate,
  logTermsConsent as auditLogTermsConsent,
  logPiiView as auditLogPiiView,
  logPiiDeletionRequest as auditLogPiiDeletionRequest,
  logSecurityAlert as auditLogSecurityAlert,
} from "./audit";

// ===== 기존 코드 유지 (호환성 보장) =====
export interface LogEntry {
  ts: string;
  event: string;
  result: "success" | "fail";
  code?: string;
  http_status?: number;
  request_id?: string;
  trace_id?: string; // 🆕 추가: OpenTelemetry trace ID
  span_id?: string; // 🆕 추가: OpenTelemetry span ID
  user_id?: string | null;
  phone_hash?: string;
  ip?: string;
  provider?: string;
  retry_after_sec?: number;
  rl?: {
    scope: "phone" | "ip" | "combo";
    limit: number;
    remaining: number;
    reset_sec: number;
  };
  latency_ms?: number;
  error?: string;
  [key: string]: any;
}

// 🆕 OpenTelemetry trace 정보 추출 헬퍼
function getTraceInfo() {
  try {
    const activeContext = context.active();
    const span = trace.getSpan(activeContext);

    if (span) {
      const spanContext = span.spanContext();
      return {
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
      };
    }
  } catch (e) {
    // OpenTelemetry가 비활성화된 경우 무시
  }

  return {
    trace_id: "unknown",
    span_id: "unknown",
  };
}

// 🆕 보안 로깅 헬퍼
function createSecureLogEntry(event: string, result: "success" | "fail", data?: any): LogEntry {
  const traceInfo = getTraceInfo();

  // 민감정보 제거
  const sanitizedData = data ? sanitizeObject(data) : {};

  return {
    ts: new Date().toISOString(),
    event,
    result,
    ...traceInfo, // 🆕 trace 정보 자동 포함
    ...sanitizedData,
  };
}

export function createLogEntry(event: string, result: "success" | "fail"): LogEntry {
  return createSecureLogEntry(event, result);
}

export function hashPhone(phone: string): string {
  return `sha256:${crypto.createHash("sha256").update(phone).digest("hex").substring(0, 8)}`;
}

export function logToConsole(entry: LogEntry): void {
  const level = entry.result === "success" ? "INFO" : "ERROR";
  const prefix = `[${level}] [${entry.event}]`;

  if (entry.result === "success") {
    console.log(prefix, JSON.stringify(entry));
  } else {
    console.error(prefix, JSON.stringify(entry));
  }
}

export function logToFile(entry: LogEntry): void {
  // TODO: 파일 로깅 구현 (winston 등 사용)
  logToConsole(entry);
}

export function logToDatabase(entry: LogEntry): void {
  // TODO: 데이터베이스 로깅 구현
  logToConsole(entry);
}

// 메인 로깅 함수
export function log(entry: LogEntry): void {
  // 개발 환경에서는 콘솔만, 프로덕션에서는 파일/DB도
  if (process.env.NODE_ENV === "production") {
    logToFile(entry);
    logToDatabase(entry);
  } else {
    logToConsole(entry);
  }
}

// OTP 관련 로깅 헬퍼 (기존 함수 유지)
export function logOtpSend(
  result: "success" | "fail",
  code: string,
  httpStatus: number,
  requestId: string,
  phone: string,
  ip: string,
  provider: string = "SENS",
  retryAfterSec?: number,
  rateLimit?: LogEntry["rl"],
  latencyMs?: number,
  error?: string,
): void {
  const entry = createSecureLogEntry("otp_send", result, {
    code,
    http_status: httpStatus,
    request_id: requestId,
    phone_hash: hashPhone(phone),
    ip,
    provider,
    retry_after_sec: retryAfterSec,
    rl: rateLimit,
    latency_ms: latencyMs,
    error: error ? sanitizeError(error) : undefined,
  });

  log(entry);

  // 🆕 새로운 pino 로거로도 전송 (선택적)
  if (process.env.ENABLE_PINO_LOGGING === "true") {
    try {
      const traceInfo = getTraceInfo();
      pinoLogger.info(
        {
          type: "otp_send",
          status: result,
          code,
          httpStatus,
          requestId,
          phone: hashPhone(phone), // 보안상 해시만
          ip,
          provider,
          retryAfterSec,
          rateLimitInfo: rateLimit,
          latencyMs,
          error: error ? sanitizeError(error) : undefined,
          timestamp: new Date().toISOString(),
          ...traceInfo, // 🆕 trace 정보 포함
        },
        `OTP Send: ${result} - ${code}`,
      );
    } catch (e) {
      // pino 로깅 실패 시 기존 로깅은 계속 동작
      console.warn("[PINO] Logging failed, fallback to console:", e);
    }
  }
}

export function logOtpVerify(
  result: "success" | "fail",
  code: string,
  httpStatus: number,
  requestId: string,
  phone: string,
  ip: string,
  userId?: string,
  latencyMs?: number,
  error?: string,
): void {
  const entry = createSecureLogEntry("otp_verify", result, {
    code,
    http_status: httpStatus,
    request_id: requestId,
    phone_hash: hashPhone(phone),
    ip,
    user_id: userId,
    latency_ms: latencyMs,
    error: error ? sanitizeError(error) : undefined,
  });

  log(entry);

  // 🆕 새로운 pino 로거로도 전송 (선택적)
  if (process.env.ENABLE_PINO_LOGGING === "true") {
    try {
      const traceInfo = getTraceInfo();
      pinoLogger.info(
        {
          type: "otp_verify",
          status: result,
          code,
          httpStatus,
          requestId,
          phone: hashPhone(phone), // 보안상 해시만
          ip,
          userId,
          latencyMs,
          error: error ? sanitizeError(error) : undefined,
          timestamp: new Date().toISOString(),
          ...traceInfo, // 🆕 trace 정보 포함
        },
        `OTP Verify: ${result} - ${code}`,
      );
    } catch (e) {
      // pino 로깅 실패 시 기존 로깅은 계속 동작
      console.warn("[PINO] Logging failed, fallback to console:", e);
    }
  }
}

// ===== 새로운 pino 로거 (추가 기능) =====
// 로그 레벨 설정
const logLevel = process.env.LOG_LEVEL || "info";

// Loki 전송 설정 (환경변수로 제어)
const lokiConfig =
  process.env.LOKI_ENABLED === "true"
    ? {
        target: "pino-loki",
        options: {
          host: process.env.LOKI_URL || "http://localhost:3100",
          labels: {
            service: "tango-server",
            env: process.env.NODE_ENV || "dev",
            version: process.env.npm_package_version || "1.0.0",
          },
          batching: true,
          interval: 2000,
          // 백프레셔/재시도 설정
          replaceTimestamp: true,
          removeColors: true,
          // 전송 실패 시 재시도
          retries: 3,
          retryDelay: 1000,
        },
      }
    : undefined;

// pino 로거 설정
export const pinoLogger = pino({
  level: logLevel,
  // 기본 포맷팅 (개발 환경에서만)
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
  // Loki 전송 설정 (프로덕션 환경에서만)
  ...(lokiConfig &&
    process.env.NODE_ENV === "production" && {
      transport: lokiConfig,
    }),
});

// 🆕 보안 로깅 헬퍼 (민감정보 제거 + trace 정보 포함)
function createSecureTraceLog(data: any) {
  const traceInfo = getTraceInfo();
  const sanitizedData = sanitizeObject(data);

  return {
    ...sanitizedData,
    ...traceInfo,
    timestamp: new Date().toISOString(),
  };
}

// 🆕 보안 로깅 함수들 (로그 샘플링 + 민감정보 제거)
function secureLog(level: string, msg: string, data?: any) {
  // 로그 샘플링 체크
  if (!shouldLogWithEnv(level)) {
    return; // 샘플링에 의해 드롭
  }

  // 메시지에서 민감정보 제거
  const sanitizedMsg = sanitizeLogMessage(msg);

  // 데이터에서 민감정보 제거
  const secureData = createSecureTraceLog(data || {});

  // 로그 레벨별 처리
  switch (level.toLowerCase()) {
    case "info":
      pinoLogger.info(secureData, sanitizedMsg);
      break;
    case "warn":
      pinoLogger.warn(secureData, sanitizedMsg);
      break;
    case "error":
      pinoLogger.error(secureData, sanitizedMsg);
      break;
    case "debug":
      pinoLogger.debug(secureData, sanitizedMsg);
      break;
    default:
      pinoLogger.info(secureData, sanitizedMsg);
  }
}

// 새로운 로깅 헬퍼 함수들 (기존과 별개)
export const newLog = {
  info: (msg: string, data?: any) => secureLog("info", msg, data),
  warn: (msg: string, data?: any) => secureLog("warn", msg, data),
  error: (msg: string, data?: any) => secureLog("error", msg, data),
  debug: (msg: string, data?: any) => secureLog("debug", msg, data),

  // ===== OTP 관련 로깅 (보안 강화) =====
  otp: {
    send: (
      status: "success" | "fail",
      requestId: string,
      phone: string,
      ip: string,
      provider: string,
      carrier: string,
      userId?: string,
      error?: string,
    ) => {
      secureLog("info", `OTP Send: ${status}`, {
        type: "otp_send",
        status,
        requestId,
        phone: maskPhone(phone), // 전화번호 마스킹
        ip,
        provider,
        carrier,
        userId,
        error: error ? sanitizeError(error) : undefined,
      });

      // 🆕 Audit 로그 추가: OTP 전송 시 사용자 등록 감사 로그 (신규 사용자인 경우)
      if (status === "success" && !userId) {
        auditLogUserRegistration(requestId, { phone, provider, carrier }, ip);
      }
    },

    verify: (
      status: "success" | "fail",
      code: string,
      httpStatus: number,
      requestId: string,
      phone: string,
      ip: string,
      userId?: string,
      latencyMs?: number,
      error?: string,
    ) => {
      secureLog("info", `OTP Verify: ${status}`, {
        type: "otp_verify",
        status,
        code,
        httpStatus,
        requestId,
        phone: maskPhone(phone), // 전화번호 마스킹
        ip,
        userId,
        latencyMs,
        error: error ? sanitizeError(error) : undefined,
      });

      // 🆕 Audit 로그 추가: OTP 검증 성공 시 로그인 감사 로그
      if (status === "success" && userId) {
        auditLogUserLogin(requestId, userId, phone, ip);
      }
    },
  },

  auth: {
    login: (
      status: "success" | "fail",
      requestId: string,
      phone: string,
      ip: string,
      userId?: string,
      error?: string,
    ) => {
      secureLog("info", `Auth Login: ${status}`, {
        type: "auth_login",
        status,
        requestId,
        phone: maskPhone(phone), // 전화번호 마스킹
        ip,
        userId,
        error: error ? sanitizeError(error) : undefined,
      });

      // 🆕 Audit 로그 추가: 로그인 성공 시 감사 로그
      if (status === "success" && userId) {
        auditLogUserLogin(requestId, userId, phone, ip);
      }
    },

    register: (
      status: "success" | "fail",
      requestId: string,
      phone: string,
      ip: string,
      userId?: string,
      error?: string,
    ) => {
      secureLog("info", `Auth Register: ${status}`, {
        type: "auth_register",
        status,
        requestId,
        phone: maskPhone(phone), // 전화번호 마스킹
        ip,
        userId,
        error: error ? sanitizeError(error) : undefined,
      });

      // 🆕 Audit 로그 추가: 사용자 등록 성공 시 감사 로그
      if (status === "success" && userId) {
        auditLogUserRegistration(requestId, { id: userId, phone }, ip);
      }
    },
  },

  rateLimit: {
    exceeded: (
      scope: "phone" | "ip" | "combo",
      requestId: string,
      phone: string,
      ip: string,
      limit: number,
      remaining: number,
      resetSec: number,
    ) => {
      secureLog("warn", `Rate Limit Exceeded: ${scope}`, {
        type: "rate_limit_exceeded",
        scope,
        requestId,
        phone: maskPhone(phone), // 전화번호 마스킹
        ip,
        limit,
        remaining,
        resetSec,
      });

      // 🆕 Audit 로그 추가: 레이트리밋 초과 시 보안 경고 감사 로그
      auditLogSecurityAlert(
        requestId,
        "RATE_LIMIT_EXCEEDED",
        scope === "combo" ? "high" : "medium",
        `Rate limit exceeded for ${scope}: ${phone ? maskPhone(phone) : "unknown"} from IP ${ip}`,
        ip,
        undefined,
        phone,
      );
    },
  },

  // 🆕 HTTP 요청/응답 로깅 (보안 강화)
  http: {
    request: (method: string, url: string, headers?: any, body?: any, requestId?: string) => {
      secureLog("info", `HTTP Request: ${method} ${sanitizeUrl(url)}`, {
        type: "http_request",
        method,
        url: sanitizeUrl(url),
        headers: sanitizeHeaders(headers),
        body: sanitizeHttpBody(body),
        requestId,
      });
    },

    response: (
      statusCode: number,
      url: string,
      headers?: any,
      body?: any,
      requestId?: string,
      latencyMs?: number,
    ) => {
      secureLog("info", `HTTP Response: ${statusCode} ${sanitizeUrl(url)}`, {
        type: "http_response",
        statusCode,
        url: sanitizeUrl(url),
        headers: sanitizeHeaders(headers),
        body: sanitizeHttpBody(body),
        requestId,
        latencyMs,
      });
    },
  },
};

// 로거 상태 확인
export const getLoggerStatus = () => ({
  level: pinoLogger.level,
  lokiEnabled: process.env.LOKI_ENABLED === "true",
  lokiUrl: process.env.LOKI_URL,
  environment: process.env.NODE_ENV,
  version: process.env.npm_package_version,
  pinoEnabled: process.env.ENABLE_PINO_LOGGING === "true",
  tracingEnabled: process.env.OTEL_ENABLED === "true", // 🆕 추가
  security: getSecurityStatus(), // 🆕 보안 상태 추가
});

// 로거 초기화 완료 로그
console.log("[LOGGER] Initialized with status:", getLoggerStatus());
