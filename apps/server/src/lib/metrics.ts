import client from 'prom-client';

// ===== Prometheus 클라이언트 설정 =====

// 기본 메트릭 수집 (CPU, 메모리, 이벤트 루프 등)
client.collectDefaultMetrics({ 
  register: client.register,
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
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP 요청 지연시간 (밀리초)',
  labelNames: ['method', 'route', 'status', 'endpoint'],
  buckets: [10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
  registers: [client.register]
});

/**
 * HTTP 요청 총 개수 카운터
 */
export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: '총 HTTP 요청 개수',
  labelNames: ['method', 'route', 'status', 'endpoint'],
  registers: [client.register]
});

/**
 * HTTP 에러율 게이지
 */
export const httpErrorRate = new client.Gauge({
  name: 'http_error_rate',
  help: 'HTTP 에러율 (5xx 응답 비율)',
  labelNames: ['method', 'route', 'endpoint'],
  registers: [client.register]
});

// ===== OTP 관련 메트릭 =====

/**
 * OTP 전송 성공/실패 카운터
 */
export const otpSendTotal = new client.Counter({
  name: 'otp_send_total',
  help: 'OTP 전송 총 개수',
  labelNames: ['status', 'provider', 'carrier'],
  registers: [client.register]
});

/**
 * OTP 검증 성공/실패 카운터
 */
export const otpVerifyTotal = new client.Counter({
  name: 'otp_verify_total',
  help: 'OTP 검증 총 개수',
  labelNames: ['status', 'reason'],
  registers: [client.register]
});

/**
 * OTP 실패 사유별 카운터
 */
export const otpFailureReasons = new client.Counter({
  name: 'otp_failure_reasons_total',
  help: 'OTP 실패 사유별 카운트',
  labelNames: ['reason', 'code'],
  registers: [client.register]
});

// ===== 레이트리밋 메트릭 =====

/**
 * 레이트리밋 발생 횟수
 */
export const rateLimitExceeded = new client.Counter({
  name: 'rate_limit_exceeded_total',
  help: '레이트리밋 초과 발생 횟수',
  labelNames: ['scope', 'type'],
  registers: [client.register]
});

/**
 * 레이트리밋 남은 요청 수
 */
export const rateLimitRemaining = new client.Gauge({
  name: 'rate_limit_remaining',
  help: '레이트리밋 남은 요청 수',
  labelNames: ['scope', 'type'],
  registers: [client.register]
});

// ===== 인증 관련 메트릭 =====

/**
 * 사용자 등록 성공/실패 카운터
 */
export const userRegistrationTotal = new client.Counter({
  name: 'user_registration_total',
  help: '사용자 등록 총 개수',
  labelNames: ['status', 'reason'],
  registers: [client.register]
});

/**
 * 사용자 로그인 성공/실패 카운터
 */
export const userLoginTotal = new client.Counter({
  name: 'user_login_total',
  help: '사용자 로그인 총 개수',
  labelNames: ['status', 'reason'],
  registers: [client.register]
});

// ===== 데이터베이스 메트릭 =====

/**
 * 데이터베이스 쿼리 지연시간
 */
export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_ms',
  help: '데이터베이스 쿼리 지연시간 (밀리초)',
  labelNames: ['operation', 'table'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [client.register]
});

/**
 * 데이터베이스 연결 풀 상태
 */
export const dbConnectionPool = new client.Gauge({
  name: 'db_connection_pool',
  help: '데이터베이스 연결 풀 상태',
  labelNames: ['state'],
  registers: [client.register]
});

// ===== Redis 메트릭 =====

/**
 * Redis 작업 지연시간
 */
export const redisOperationDuration = new client.Histogram({
  name: 'redis_operation_duration_ms',
  help: 'Redis 작업 지연시간 (밀리초)',
  labelNames: ['operation', 'key_pattern'],
  buckets: [1, 2, 5, 10, 25, 50, 100, 250],
  registers: [client.register]
});

/**
 * Redis 메모리 사용량
 */
export const redisMemoryUsage = new client.Gauge({
  name: 'redis_memory_usage_bytes',
  help: 'Redis 메모리 사용량 (바이트)',
  registers: [client.register]
});

// ===== 비즈니스 로직 메트릭 =====

/**
 * 활성 사용자 수
 */
export const activeUsers = new client.Gauge({
  name: 'active_users_total',
  help: '현재 활성 사용자 수',
  registers: [client.register]
});

/**
 * 일일 신규 가입자 수
 */
export const dailyNewUsers = new client.Counter({
  name: 'daily_new_users_total',
  help: '일일 신규 가입자 수',
  labelNames: ['date'],
  registers: [client.register]
});

// ===== 메트릭 헬퍼 함수들 =====

/**
 * HTTP 요청 시작 시 호출
 */
export function startHttpRequestTimer(method: string, route: string, endpoint: string) {
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
export function endHttpRequestTimer(timer: ReturnType<typeof startHttpRequestTimer>, statusCode: number) {
  const duration = Date.now() - timer.startTime;
  const status = Math.floor(statusCode / 100) * 100; // 200, 300, 400, 500
  
  // 지연시간 히스토그램
  httpRequestDuration
    .labels(timer.method, timer.route, String(status), timer.endpoint)
    .observe(duration);
  
  // 총 요청 수 카운터
  httpRequestTotal
    .labels(timer.method, timer.route, String(status), timer.endpoint)
    .inc();
  
  // 에러율 계산 (5xx 응답)
  if (status >= 500) {
    // 🆕 .get() 메서드 제거하고 단순히 에러율을 100%로 설정
    // Counter 메트릭은 .get() 메서드를 지원하지 않음
    httpErrorRate
      .labels(timer.method, timer.route, timer.endpoint)
      .set(100); // 5xx 응답이 발생하면 에러율을 100%로 설정
  }
}

/**
 * OTP 전송 메트릭 업데이트
 */
export function recordOtpSend(status: 'success' | 'fail', provider: string, carrier: string) {
  otpSendTotal
    .labels(status, provider, carrier)
    .inc();
}

/**
 * OTP 검증 메트릭 업데이트
 */
export function recordOtpVerify(status: 'success' | 'fail', reason?: string) {
  otpVerifyTotal
    .labels(status, reason || 'unknown')
    .inc();
  
  if (status === 'fail' && reason) {
    otpFailureReasons
      .labels(reason, 'OTP_VERIFY_FAIL')
      .inc();
  }
}

/**
 * 레이트리밋 메트릭 업데이트
 */
export function recordRateLimitExceeded(scope: 'phone' | 'ip' | 'combo', type: string) {
  rateLimitExceeded
    .labels(scope, type)
    .inc();
}

/**
 * 사용자 등록 메트릭 업데이트
 */
export function recordUserRegistration(status: 'success' | 'fail', reason?: string) {
  userRegistrationTotal
    .labels(status, reason || 'unknown')
    .inc();
  
  if (status === 'success') {
    dailyNewUsers
      .labels(new Date().toISOString().split('T')[0])
      .inc();
  }
}

/**
 * 사용자 로그인 메트릭 업데이트
 */
export function recordUserLogin(status: 'success' | 'fail', reason?: string) {
  userLoginTotal
    .labels(status, reason || 'unknown')
    .inc();
}

/**
 * 데이터베이스 쿼리 메트릭 업데이트
 */
export function recordDbQuery(operation: string, table: string, duration: number) {
  dbQueryDuration
    .labels(operation, table)
    .observe(duration);
}

/**
 * Redis 작업 메트릭 업데이트
 */
export function recordRedisOperation(operation: string, keyPattern: string, duration: number) {
  redisOperationDuration
    .labels(operation, keyPattern)
    .observe(duration);
}

// ===== 메트릭 수집기 설정 =====

/**
 * 커스텀 메트릭 수집기
 */
export const customCollectors = {
  // 활성 사용자 수 수집
  activeUsers: new client.Gauge({
    name: 'custom_active_users',
    help: '커스텀 활성 사용자 수',
    registers: [client.register]
  }),
  
  // 시스템 상태 점수
  systemHealthScore: new client.Gauge({
    name: 'custom_system_health_score',
    help: '시스템 상태 점수 (0-100)',
    registers: [client.register]
  })
};

// ===== 메트릭 레지스트리 =====

/**
 * 메트릭 레지스트리 내보내기
 */
export const metricsRegistry = client.register;

/**
 * 메트릭 데이터 수집
 */
export async function getMetrics(): Promise<string> {
  return await client.register.metrics();
}

/**
 * 메트릭 상태 확인
 */
export function getMetricsStatus() {
  return {
    enabled: true,
    defaultMetrics: true,
    customMetrics: Object.keys(customCollectors).length,
    registry: 'prometheus',
    endpoint: '/metrics'
  };
}

// ===== 메트릭 초기화 완료 로그 =====
console.log('[METRICS] Prometheus metrics initialized:', getMetricsStatus());
