import { Request, Response, NextFunction } from "express";
import { createClient } from "redis";

// Redis 클라이언트 (기존 설정 재사용)
const redis = createClient({
  url: process.env.REDIS_URL || "redis://redis:6379"
});

export function withIdempotency(ttlSec = 300) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers["idempotency-key"] as string;
    if (!key) return next();
    
    const cacheKey = `idem:${key}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const { status, body, headers } = JSON.parse(cached);
        for (const [k, v] of Object.entries(headers || {})) {
          res.setHeader(k, v as string);
        }
        return res.status(status).send(body);
      }
      
      // 응답을 캐시하기 위해 res.send를 후킹
      const originalSend = res.send.bind(res);
      (res as any).send = async (body: any) => {
        try {
          const snapshot = { 
            status: res.statusCode, 
            body, 
            headers: { 
              "content-type": res.getHeader("content-type") 
            } 
          };
          await redis.setEx(cacheKey, ttlSec, JSON.stringify(snapshot));
        } catch (error) {
          console.error("Failed to cache idempotency response:", error);
        }
        return originalSend(body);
      };
      
      next();
    } catch (error) {
      console.error("Idempotency check failed:", error);
      next(); // 에러 발생 시 제한 없이 통과
    }
  };
}
