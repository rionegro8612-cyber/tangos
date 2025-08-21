import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // X-Request-ID 헤더가 있으면 사용, 없으면 새로 생성
  req.requestId = req.headers['x-request-id'] as string || randomUUID();
  
  // 응답 헤더에도 requestId 포함
  res.set('X-Request-ID', req.requestId);
  
  next();
}
