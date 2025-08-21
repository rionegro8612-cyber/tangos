// 백엔드 구조화 로깅 유틸리티
import crypto from 'crypto';

export interface LogEntry {
  ts: string;
  event: string;
  result: 'success' | 'fail';
  code?: string;
  http_status?: number;
  request_id?: string;
  user_id?: string | null;
  phone_hash?: string;
  ip?: string;
  provider?: string;
  retry_after_sec?: number;
  rl?: {
    scope: 'phone' | 'ip' | 'combo';
    limit: number;
    remaining: number;
    reset_sec: number;
  };
  latency_ms?: number;
  error?: string;
  [key: string]: any;
}

export function createLogEntry(event: string, result: 'success' | 'fail'): LogEntry {
  return {
    ts: new Date().toISOString(),
    event,
    result
  };
}

export function hashPhone(phone: string): string {
  return `sha256:${crypto.createHash('sha256').update(phone).digest('hex').substring(0, 8)}`;
}

export function logToConsole(entry: LogEntry): void {
  const level = entry.result === 'success' ? 'INFO' : 'ERROR';
  const prefix = `[${level}] [${entry.event}]`;
  
  if (entry.result === 'success') {
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
  if (process.env.NODE_ENV === 'production') {
    logToFile(entry);
    logToDatabase(entry);
  } else {
    logToConsole(entry);
  }
}

// OTP 관련 로깅 헬퍼
export function logOtpSend(
  result: 'success' | 'fail',
  code: string,
  httpStatus: number,
  requestId: string,
  phone: string,
  ip: string,
  provider: string = 'SENS',
  retryAfterSec?: number,
  rateLimit?: LogEntry['rl'],
  latencyMs?: number,
  error?: string
): void {
  const entry = createLogEntry('otp_send', result);
  
  Object.assign(entry, {
    code,
    http_status: httpStatus,
    request_id: requestId,
    phone_hash: hashPhone(phone),
    ip,
    provider,
    retry_after_sec: retryAfterSec,
    rl: rateLimit,
    latency_ms: latencyMs,
    error
  });
  
  log(entry);
}

export function logOtpVerify(
  result: 'success' | 'fail',
  code: string,
  httpStatus: number,
  requestId: string,
  phone: string,
  ip: string,
  userId?: string,
  latencyMs?: number,
  error?: string
): void {
  const entry = createLogEntry('otp_verify', result);
  
  Object.assign(entry, {
    code,
    http_status: httpStatus,
    request_id: requestId,
    phone_hash: hashPhone(phone),
    ip,
    user_id: userId,
    latency_ms: latencyMs,
    error
  });
  
  log(entry);
}
