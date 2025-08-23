// apps/server/src/middlewares/errorTracking.ts
/**
 * 에러율 추적 미들웨어
 */

import type { Request, Response, NextFunction } from 'express';
import { errorTracker } from '../lib/health';

/**
 * 응답 후 에러율 추적
 */
export function errorTrackingMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalSend = res.send;
  const originalJson = res.json;
  
  // 응답 가로채기
  res.send = function(body: any) {
    trackResponse(req, res);
    return originalSend.call(this, body);
  };
  
  res.json = function(body: any) {
    trackResponse(req, res);
    return originalJson.call(this, body);
  };
  
  next();
}

/**
 * 응답 추적
 */
function trackResponse(req: Request, res: Response) {
  const endpoint = getEndpointKey(req);
  const isError = res.statusCode >= 400;
  
  errorTracker.addRequest(endpoint, isError);
  
  // 에러인 경우 추가 로깅
  if (isError && process.env.NODE_ENV === 'development') {
    console.log(`[ERROR_TRACKING] ${endpoint}: ${res.statusCode}`);
  }
}

/**
 * 엔드포인트 키 생성
 */
function getEndpointKey(req: Request): string {
  const method = req.method;
  const path = req.route?.path || req.path;
  
  // 패턴화된 경로로 변환 (ID 등 동적 부분 제거)
  const normalizedPath = path
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
    .replace(/\/[a-f0-9]{24}/g, '/:objectId');
  
  return `${method} ${normalizedPath}`;
}
