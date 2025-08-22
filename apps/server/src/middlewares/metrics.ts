import { Request, Response, NextFunction } from 'express';
import { startHttpRequestTimer, endHttpRequestTimer } from '../lib/metrics';

/**
 * HTTP 요청 메트릭 수집 미들웨어
 * 
 * 수집하는 메트릭:
 * - HTTP 요청 지연시간 (p50, p95, p99)
 * - HTTP 요청 총 개수
 * - HTTP 에러율 (5xx 응답 비율)
 * - 라우트별, 메서드별, 상태코드별 분류
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // 요청 시작 시간 기록
  const timer = startHttpRequestTimer(
    req.method,
    req.route?.path || req.path,
    getEndpointFromPath(req.path)
  );
  
  // 요청 완료 시 메트릭 업데이트
  res.on('finish', () => {
    endHttpRequestTimer(timer, res.statusCode);
  });
  
  next();
}

/**
 * 경로에서 엔드포인트 추출
 * 예: /api/v1/auth/send-sms → auth_send_sms
 */
function getEndpointFromPath(path: string): string {
  if (!path) return 'unknown';
  
  // /api/v1/auth/send-sms → auth_send_sms
  const parts = path
    .split('/')
    .filter(part => part && part !== 'api' && part !== 'v1')
    .join('_');
  
  return parts || 'root';
}

/**
 * 라우트별 메트릭 라벨 생성
 */
function getRouteLabel(req: Request): string {
  if (req.route?.path) {
    return req.route.path;
  }
  
  // 동적 라우트 처리 (예: /users/:id → /users/:id)
  if (req.path.includes('/:')) {
    return req.path.replace(/\/:[^/]+/g, '/:param');
  }
  
  return req.path;
}

/**
 * 상태코드 그룹화
 * 200-299: 2xx, 300-399: 3xx, 400-499: 4xx, 500-599: 5xx
 */
function getStatusGroup(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return '2xx';
  if (statusCode >= 300 && statusCode < 400) return '3xx';
  if (statusCode >= 400 && statusCode < 500) return '4xx';
  if (statusCode >= 500 && statusCode < 600) return '5xx';
  return 'unknown';
}

export default metricsMiddleware;
