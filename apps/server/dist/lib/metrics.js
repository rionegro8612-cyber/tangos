"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsRegistry = exports.customCollectors = exports.dailyNewUsers = exports.activeUsers = exports.redisMemoryUsage = exports.redisOperationDuration = exports.dbConnectionPool = exports.dbQueryDuration = exports.userLoginTotal = exports.userRegistrationTotal = exports.rateLimitRemaining = exports.rateLimitExceeded = exports.otpFailureReasons = exports.otpVerifyTotal = exports.otpSendTotal = exports.httpErrorRate = exports.httpRequestTotal = exports.httpRequestDuration = void 0;
exports.startHttpRequestTimer = startHttpRequestTimer;
exports.endHttpRequestTimer = endHttpRequestTimer;
exports.recordOtpSend = recordOtpSend;
exports.recordOtpVerify = recordOtpVerify;
exports.recordRateLimitExceeded = recordRateLimitExceeded;
exports.recordUserRegistration = recordUserRegistration;
exports.recordUserLogin = recordUserLogin;
exports.recordDbQuery = recordDbQuery;
exports.recordRedisOperation = recordRedisOperation;
exports.getMetrics = getMetrics;
exports.getMetricsStatus = getMetricsStatus;
const prom_client_1 = __importDefault(require("prom-client"));
// ===== Prometheus 클라이언트 설정 =====
// 기본 메트릭 수집 (CPU, 메모리, 이벤트 루프 등)
prom_client_1.default.collectDefaultMetrics({
    register: prom_client_1.default.register,
    prefix: 'tango_server_',
    labels: {
        service: 'tango-server',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    }
});
// ===== HTTP 요청 메트릭 =====
/**
 * HTTP 요청 지연시간 히스토그램
 * p50, p95, p99 지연시간 측정
 */
exports.httpRequestDuration = new prom_client_1.default.Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP 요청 지연시간 (밀리초)',
    labelNames: ['method', 'route', 'status', 'endpoint'],
    buckets: [10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
    registers: [prom_client_1.default.register]
});
/**
 * HTTP 요청 총 개수 카운터
 */
exports.httpRequestTotal = new prom_client_1.default.Counter({
    name: 'http_requests_total',
    help: '총 HTTP 요청 개수',
    labelNames: ['method', 'route', 'status', 'endpoint'],
    registers: [prom_client_1.default.register]
});
/**
 * HTTP 에러율 게이지
 */
exports.httpErrorRate = new prom_client_1.default.Gauge({
    name: 'http_error_rate',
    help: 'HTTP 에러율 (5xx 응답 비율)',
    labelNames: ['method', 'route', 'endpoint'],
    registers: [prom_client_1.default.register]
});
// ===== OTP 관련 메트릭 =====
/**
 * OTP 전송 성공/실패 카운터
 */
exports.otpSendTotal = new prom_client_1.default.Counter({
    name: 'otp_send_total',
    help: 'OTP 전송 총 개수',
    labelNames: ['status', 'provider', 'carrier'],
    registers: [prom_client_1.default.register]
});
/**
 * OTP 검증 성공/실패 카운터
 */
exports.otpVerifyTotal = new prom_client_1.default.Counter({
    name: 'otp_verify_total',
    help: 'OTP 검증 총 개수',
    labelNames: ['status', 'reason'],
    registers: [prom_client_1.default.register]
});
/**
 * OTP 실패 사유별 카운터
 */
exports.otpFailureReasons = new prom_client_1.default.Counter({
    name: 'otp_failure_reasons_total',
    help: 'OTP 실패 사유별 카운트',
    labelNames: ['reason', 'code'],
    registers: [prom_client_1.default.register]
});
// ===== 레이트리밋 메트릭 =====
/**
 * 레이트리밋 발생 횟수
 */
exports.rateLimitExceeded = new prom_client_1.default.Counter({
    name: 'rate_limit_exceeded_total',
    help: '레이트리밋 초과 발생 횟수',
    labelNames: ['scope', 'type'],
    registers: [prom_client_1.default.register]
});
/**
 * 레이트리밋 남은 요청 수
 */
exports.rateLimitRemaining = new prom_client_1.default.Gauge({
    name: 'rate_limit_remaining',
    help: '레이트리밋 남은 요청 수',
    labelNames: ['scope', 'type'],
    registers: [prom_client_1.default.register]
});
// ===== 인증 관련 메트릭 =====
/**
 * 사용자 등록 성공/실패 카운터
 */
exports.userRegistrationTotal = new prom_client_1.default.Counter({
    name: 'user_registration_total',
    help: '사용자 등록 총 개수',
    labelNames: ['status', 'reason'],
    registers: [prom_client_1.default.register]
});
/**
 * 사용자 로그인 성공/실패 카운터
 */
exports.userLoginTotal = new prom_client_1.default.Counter({
    name: 'user_login_total',
    help: '사용자 로그인 총 개수',
    labelNames: ['status', 'reason'],
    registers: [prom_client_1.default.register]
});
// ===== 데이터베이스 메트릭 =====
/**
 * 데이터베이스 쿼리 지연시간
 */
exports.dbQueryDuration = new prom_client_1.default.Histogram({
    name: 'db_query_duration_ms',
    help: '데이터베이스 쿼리 지연시간 (밀리초)',
    labelNames: ['operation', 'table'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    registers: [prom_client_1.default.register]
});
/**
 * 데이터베이스 연결 풀 상태
 */
exports.dbConnectionPool = new prom_client_1.default.Gauge({
    name: 'db_connection_pool',
    help: '데이터베이스 연결 풀 상태',
    labelNames: ['state'],
    registers: [prom_client_1.default.register]
});
// ===== Redis 메트릭 =====
/**
 * Redis 작업 지연시간
 */
exports.redisOperationDuration = new prom_client_1.default.Histogram({
    name: 'redis_operation_duration_ms',
    help: 'Redis 작업 지연시간 (밀리초)',
    labelNames: ['operation', 'key_pattern'],
    buckets: [1, 2, 5, 10, 25, 50, 100, 250],
    registers: [prom_client_1.default.register]
});
/**
 * Redis 메모리 사용량
 */
exports.redisMemoryUsage = new prom_client_1.default.Gauge({
    name: 'redis_memory_usage_bytes',
    help: 'Redis 메모리 사용량 (바이트)',
    registers: [prom_client_1.default.register]
});
// ===== 비즈니스 로직 메트릭 =====
/**
 * 활성 사용자 수
 */
exports.activeUsers = new prom_client_1.default.Gauge({
    name: 'active_users_total',
    help: '현재 활성 사용자 수',
    registers: [prom_client_1.default.register]
});
/**
 * 일일 신규 가입자 수
 */
exports.dailyNewUsers = new prom_client_1.default.Counter({
    name: 'daily_new_users_total',
    help: '일일 신규 가입자 수',
    labelNames: ['date'],
    registers: [prom_client_1.default.register]
});
// ===== 메트릭 헬퍼 함수들 =====
/**
 * HTTP 요청 시작 시 호출
 */
function startHttpRequestTimer(method, route, endpoint) {
    return {
        method,
        route,
        endpoint,
        startTime: Date.now()
    };
}
/**
 * HTTP 요청 완료 시 호출
 */
function endHttpRequestTimer(timer, statusCode) {
    const duration = Date.now() - timer.startTime;
    const status = Math.floor(statusCode / 100) * 100; // 200, 300, 400, 500
    // 지연시간 히스토그램
    exports.httpRequestDuration
        .labels(timer.method, timer.route, String(status), timer.endpoint)
        .observe(duration);
    // 총 요청 수 카운터
    exports.httpRequestTotal
        .labels(timer.method, timer.route, String(status), timer.endpoint)
        .inc();
    // 에러율 계산 (5xx 응답)
    if (status >= 500) {
        // 🆕 .get() 메서드 제거하고 단순히 에러율을 100%로 설정
        // Counter 메트릭은 .get() 메서드를 지원하지 않음
        exports.httpErrorRate
            .labels(timer.method, timer.route, timer.endpoint)
            .set(100); // 5xx 응답이 발생하면 에러율을 100%로 설정
    }
}
/**
 * OTP 전송 메트릭 업데이트
 */
function recordOtpSend(status, provider, carrier) {
    exports.otpSendTotal
        .labels(status, provider, carrier)
        .inc();
}
/**
 * OTP 검증 메트릭 업데이트
 */
function recordOtpVerify(status, reason) {
    exports.otpVerifyTotal
        .labels(status, reason || 'unknown')
        .inc();
    if (status === 'fail' && reason) {
        exports.otpFailureReasons
            .labels(reason, 'OTP_VERIFY_FAIL')
            .inc();
    }
}
/**
 * 레이트리밋 메트릭 업데이트
 */
function recordRateLimitExceeded(scope, type) {
    exports.rateLimitExceeded
        .labels(scope, type)
        .inc();
}
/**
 * 사용자 등록 메트릭 업데이트
 */
function recordUserRegistration(status, reason) {
    exports.userRegistrationTotal
        .labels(status, reason || 'unknown')
        .inc();
    if (status === 'success') {
        exports.dailyNewUsers
            .labels(new Date().toISOString().split('T')[0])
            .inc();
    }
}
/**
 * 사용자 로그인 메트릭 업데이트
 */
function recordUserLogin(status, reason) {
    exports.userLoginTotal
        .labels(status, reason || 'unknown')
        .inc();
}
/**
 * 데이터베이스 쿼리 메트릭 업데이트
 */
function recordDbQuery(operation, table, duration) {
    exports.dbQueryDuration
        .labels(operation, table)
        .observe(duration);
}
/**
 * Redis 작업 메트릭 업데이트
 */
function recordRedisOperation(operation, keyPattern, duration) {
    exports.redisOperationDuration
        .labels(operation, keyPattern)
        .observe(duration);
}
// ===== 메트릭 수집기 설정 =====
/**
 * 커스텀 메트릭 수집기
 */
exports.customCollectors = {
    // 활성 사용자 수 수집
    activeUsers: new prom_client_1.default.Gauge({
        name: 'custom_active_users',
        help: '커스텀 활성 사용자 수',
        registers: [prom_client_1.default.register]
    }),
    // 시스템 상태 점수
    systemHealthScore: new prom_client_1.default.Gauge({
        name: 'custom_system_health_score',
        help: '시스템 상태 점수 (0-100)',
        registers: [prom_client_1.default.register]
    })
};
// ===== 메트릭 레지스트리 =====
/**
 * 메트릭 레지스트리 내보내기
 */
exports.metricsRegistry = prom_client_1.default.register;
/**
 * 메트릭 데이터 수집
 */
async function getMetrics() {
    return await prom_client_1.default.register.metrics();
}
/**
 * 메트릭 상태 확인
 */
function getMetricsStatus() {
    return {
        enabled: true,
        defaultMetrics: true,
        customMetrics: Object.keys(exports.customCollectors).length,
        registry: 'prometheus',
        endpoint: '/metrics'
    };
}
// ===== 메트릭 초기화 완료 로그 =====
console.log('[METRICS] Prometheus metrics initialized:', getMetricsStatus());
