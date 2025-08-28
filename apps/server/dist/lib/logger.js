"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLoggerStatus = exports.newLog = exports.pinoLogger = void 0;
exports.createLogEntry = createLogEntry;
exports.hashPhone = hashPhone;
exports.logToConsole = logToConsole;
exports.logToFile = logToFile;
exports.logToDatabase = logToDatabase;
exports.log = log;
exports.logOtpSend = logOtpSend;
exports.logOtpVerify = logOtpVerify;
const pino_1 = __importDefault(require("pino"));
const crypto_1 = __importDefault(require("crypto"));
const api_1 = require("@opentelemetry/api");
const security_1 = require("./security");
// 🆕 Audit 로그 통합
const audit_1 = require("./audit");
// 🆕 OpenTelemetry trace 정보 추출 헬퍼
function getTraceInfo() {
    try {
        const activeContext = api_1.context.active();
        const span = api_1.trace.getSpan(activeContext);
        if (span) {
            const spanContext = span.spanContext();
            return {
                trace_id: spanContext.traceId,
                span_id: spanContext.spanId
            };
        }
    }
    catch (e) {
        // OpenTelemetry가 비활성화된 경우 무시
    }
    return {
        trace_id: 'unknown',
        span_id: 'unknown'
    };
}
// 🆕 보안 로깅 헬퍼
function createSecureLogEntry(event, result, data) {
    const traceInfo = getTraceInfo();
    // 민감정보 제거
    const sanitizedData = data ? (0, security_1.sanitizeObject)(data) : {};
    return {
        ts: new Date().toISOString(),
        event,
        result,
        ...traceInfo, // 🆕 trace 정보 자동 포함
        ...sanitizedData
    };
}
function createLogEntry(event, result) {
    return createSecureLogEntry(event, result);
}
function hashPhone(phone) {
    return `sha256:${crypto_1.default.createHash('sha256').update(phone).digest('hex').substring(0, 8)}`;
}
function logToConsole(entry) {
    const level = entry.result === 'success' ? 'INFO' : 'ERROR';
    const prefix = `[${level}] [${entry.event}]`;
    if (entry.result === 'success') {
        console.log(prefix, JSON.stringify(entry));
    }
    else {
        console.error(prefix, JSON.stringify(entry));
    }
}
function logToFile(entry) {
    // TODO: 파일 로깅 구현 (winston 등 사용)
    logToConsole(entry);
}
function logToDatabase(entry) {
    // TODO: 데이터베이스 로깅 구현
    logToConsole(entry);
}
// 메인 로깅 함수
function log(entry) {
    // 개발 환경에서는 콘솔만, 프로덕션에서는 파일/DB도
    if (process.env.NODE_ENV === 'production') {
        logToFile(entry);
        logToDatabase(entry);
    }
    else {
        logToConsole(entry);
    }
}
// OTP 관련 로깅 헬퍼 (기존 함수 유지)
function logOtpSend(result, code, httpStatus, requestId, phone, ip, provider = 'SENS', retryAfterSec, rateLimit, latencyMs, error) {
    const entry = createSecureLogEntry('otp_send', result, {
        code,
        http_status: httpStatus,
        request_id: requestId,
        phone_hash: hashPhone(phone),
        ip,
        provider,
        retry_after_sec: retryAfterSec,
        rl: rateLimit,
        latency_ms: latencyMs,
        error: error ? (0, security_1.sanitizeError)(error) : undefined
    });
    log(entry);
    // 🆕 새로운 pino 로거로도 전송 (선택적)
    if (process.env.ENABLE_PINO_LOGGING === 'true') {
        try {
            const traceInfo = getTraceInfo();
            exports.pinoLogger.info({
                type: 'otp_send',
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
                error: error ? (0, security_1.sanitizeError)(error) : undefined,
                timestamp: new Date().toISOString(),
                ...traceInfo // 🆕 trace 정보 포함
            }, `OTP Send: ${result} - ${code}`);
        }
        catch (e) {
            // pino 로깅 실패 시 기존 로깅은 계속 동작
            console.warn('[PINO] Logging failed, fallback to console:', e);
        }
    }
}
function logOtpVerify(result, code, httpStatus, requestId, phone, ip, userId, latencyMs, error) {
    const entry = createSecureLogEntry('otp_verify', result, {
        code,
        http_status: httpStatus,
        request_id: requestId,
        phone_hash: hashPhone(phone),
        ip,
        user_id: userId,
        latency_ms: latencyMs,
        error: error ? (0, security_1.sanitizeError)(error) : undefined
    });
    log(entry);
    // 🆕 새로운 pino 로거로도 전송 (선택적)
    if (process.env.ENABLE_PINO_LOGGING === 'true') {
        try {
            const traceInfo = getTraceInfo();
            exports.pinoLogger.info({
                type: 'otp_verify',
                status: result,
                code,
                httpStatus,
                requestId,
                phone: hashPhone(phone), // 보안상 해시만
                ip,
                userId,
                latencyMs,
                error: error ? (0, security_1.sanitizeError)(error) : undefined,
                timestamp: new Date().toISOString(),
                ...traceInfo // 🆕 trace 정보 포함
            }, `OTP Verify: ${result} - ${code}`);
        }
        catch (e) {
            // pino 로깅 실패 시 기존 로깅은 계속 동작
            console.warn('[PINO] Logging failed, fallback to console:', e);
        }
    }
}
// ===== 새로운 pino 로거 (추가 기능) =====
// 로그 레벨 설정
const logLevel = process.env.LOG_LEVEL || 'info';
// Loki 전송 설정 (환경변수로 제어)
const lokiConfig = process.env.LOKI_ENABLED === 'true' ? {
    target: 'pino-loki',
    options: {
        host: process.env.LOKI_URL || 'http://localhost:3100',
        labels: {
            service: 'tango-server',
            env: process.env.NODE_ENV || 'dev',
            version: process.env.npm_package_version || '1.0.0'
        },
        batching: true,
        interval: 2000,
        // 백프레셔/재시도 설정
        replaceTimestamp: true,
        removeColors: true,
        // 전송 실패 시 재시도
        retries: 3,
        retryDelay: 1000
    }
} : undefined;
// pino 로거 설정
exports.pinoLogger = (0, pino_1.default)({
    level: logLevel,
    // 기본 포맷팅 (개발 환경에서만)
    ...(process.env.NODE_ENV !== 'production' && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname'
            }
        }
    }),
    // Loki 전송 설정 (프로덕션 환경에서만)
    ...(lokiConfig && process.env.NODE_ENV === 'production' && {
        transport: lokiConfig
    })
});
// 🆕 보안 로깅 헬퍼 (민감정보 제거 + trace 정보 포함)
function createSecureTraceLog(data) {
    const traceInfo = getTraceInfo();
    const sanitizedData = (0, security_1.sanitizeObject)(data);
    return {
        ...sanitizedData,
        ...traceInfo,
        timestamp: new Date().toISOString()
    };
}
// 🆕 보안 로깅 함수들 (로그 샘플링 + 민감정보 제거)
function secureLog(level, msg, data) {
    // 로그 샘플링 체크
    if (!(0, security_1.shouldLogWithEnv)(level)) {
        return; // 샘플링에 의해 드롭
    }
    // 메시지에서 민감정보 제거
    const sanitizedMsg = (0, security_1.sanitizeLogMessage)(msg);
    // 데이터에서 민감정보 제거
    const secureData = createSecureTraceLog(data || {});
    // 로그 레벨별 처리
    switch (level.toLowerCase()) {
        case 'info':
            exports.pinoLogger.info(secureData, sanitizedMsg);
            break;
        case 'warn':
            exports.pinoLogger.warn(secureData, sanitizedMsg);
            break;
        case 'error':
            exports.pinoLogger.error(secureData, sanitizedMsg);
            break;
        case 'debug':
            exports.pinoLogger.debug(secureData, sanitizedMsg);
            break;
        default:
            exports.pinoLogger.info(secureData, sanitizedMsg);
    }
}
// 새로운 로깅 헬퍼 함수들 (기존과 별개)
exports.newLog = {
    info: (msg, data) => secureLog('info', msg, data),
    warn: (msg, data) => secureLog('warn', msg, data),
    error: (msg, data) => secureLog('error', msg, data),
    debug: (msg, data) => secureLog('debug', msg, data),
    // ===== OTP 관련 로깅 (보안 강화) =====
    otp: {
        send: (status, requestId, phone, ip, provider, carrier, userId, error) => {
            secureLog('info', `OTP Send: ${status}`, {
                type: 'otp_send',
                status,
                requestId,
                phone: (0, security_1.maskPhone)(phone), // 전화번호 마스킹
                ip,
                provider,
                carrier,
                userId,
                error: error ? (0, security_1.sanitizeError)(error) : undefined
            });
            // 🆕 Audit 로그 추가: OTP 전송 시 사용자 등록 감사 로그 (신규 사용자인 경우)
            if (status === 'success' && !userId) {
                (0, audit_1.logUserRegistration)(requestId, { phone, provider, carrier }, ip);
            }
        },
        verify: (status, code, httpStatus, requestId, phone, ip, userId, latencyMs, error) => {
            secureLog('info', `OTP Verify: ${status}`, {
                type: 'otp_verify',
                status,
                code,
                httpStatus,
                requestId,
                phone: (0, security_1.maskPhone)(phone), // 전화번호 마스킹
                ip,
                userId,
                latencyMs,
                error: error ? (0, security_1.sanitizeError)(error) : undefined
            });
            // 🆕 Audit 로그 추가: OTP 검증 성공 시 로그인 감사 로그
            if (status === 'success' && userId) {
                (0, audit_1.logUserLogin)(requestId, userId, phone, ip);
            }
        }
    },
    auth: {
        login: (status, requestId, phone, ip, userId, error) => {
            secureLog('info', `Auth Login: ${status}`, {
                type: 'auth_login',
                status,
                requestId,
                phone: (0, security_1.maskPhone)(phone), // 전화번호 마스킹
                ip,
                userId,
                error: error ? (0, security_1.sanitizeError)(error) : undefined
            });
            // 🆕 Audit 로그 추가: 로그인 성공 시 감사 로그
            if (status === 'success' && userId) {
                (0, audit_1.logUserLogin)(requestId, userId, phone, ip);
            }
        },
        register: (status, requestId, phone, ip, userId, error) => {
            secureLog('info', `Auth Register: ${status}`, {
                type: 'auth_register',
                status,
                requestId,
                phone: (0, security_1.maskPhone)(phone), // 전화번호 마스킹
                ip,
                userId,
                error: error ? (0, security_1.sanitizeError)(error) : undefined
            });
            // 🆕 Audit 로그 추가: 사용자 등록 성공 시 감사 로그
            if (status === 'success' && userId) {
                (0, audit_1.logUserRegistration)(requestId, { id: userId, phone }, ip);
            }
        }
    },
    rateLimit: {
        exceeded: (scope, requestId, phone, ip, limit, remaining, resetSec) => {
            secureLog('warn', `Rate Limit Exceeded: ${scope}`, {
                type: 'rate_limit_exceeded',
                scope,
                requestId,
                phone: (0, security_1.maskPhone)(phone), // 전화번호 마스킹
                ip,
                limit,
                remaining,
                resetSec
            });
            // 🆕 Audit 로그 추가: 레이트리밋 초과 시 보안 경고 감사 로그
            (0, audit_1.logSecurityAlert)(requestId, 'RATE_LIMIT_EXCEEDED', scope === 'combo' ? 'high' : 'medium', `Rate limit exceeded for ${scope}: ${phone ? (0, security_1.maskPhone)(phone) : 'unknown'} from IP ${ip}`, ip, undefined, phone);
        }
    },
    // 🆕 HTTP 요청/응답 로깅 (보안 강화)
    http: {
        request: (method, url, headers, body, requestId) => {
            secureLog('info', `HTTP Request: ${method} ${(0, security_1.sanitizeUrl)(url)}`, {
                type: 'http_request',
                method,
                url: (0, security_1.sanitizeUrl)(url),
                headers: (0, security_1.sanitizeHeaders)(headers),
                body: (0, security_1.sanitizeHttpBody)(body),
                requestId
            });
        },
        response: (statusCode, url, headers, body, requestId, latencyMs) => {
            secureLog('info', `HTTP Response: ${statusCode} ${(0, security_1.sanitizeUrl)(url)}`, {
                type: 'http_response',
                statusCode,
                url: (0, security_1.sanitizeUrl)(url),
                headers: (0, security_1.sanitizeHeaders)(headers),
                body: (0, security_1.sanitizeHttpBody)(body),
                requestId,
                latencyMs
            });
        }
    }
};
// 로거 상태 확인
const getLoggerStatus = () => ({
    level: exports.pinoLogger.level,
    lokiEnabled: process.env.LOKI_ENABLED === 'true',
    lokiUrl: process.env.LOKI_URL,
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version,
    pinoEnabled: process.env.ENABLE_PINO_LOGGING === 'true',
    tracingEnabled: process.env.OTEL_ENABLED === 'true', // 🆕 추가
    security: (0, security_1.getSecurityStatus)() // 🆕 보안 상태 추가
});
exports.getLoggerStatus = getLoggerStatus;
// 로거 초기화 완료 로그
console.log('[LOGGER] Initialized with status:', (0, exports.getLoggerStatus)());
