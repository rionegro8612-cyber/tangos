import type { Request, Response, NextFunction } from "express";
import { ensureRedis } from "../lib/redis";

const memoryCache = new Map<string, { value: string; exp: number }>();
const TTL_SEC = 300;

export const withIdempotency = (ttlSeconds: number = TTL_SEC) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = (req.headers["idempotency-key"] as string) || (req.body?.requestId as string);
    if (!key) return next();

    const now = Date.now();

    async function getFromStore(): Promise<string | null> {
      // 1) Redis
      try {
        const r = await ensureRedis();
        const v = await r.get(`idem:${key}`);
        if (v) return v;
      } catch (e) {
        // fall through
      }
      // 2) In-memory fallback (dev/test only)
      const m = memoryCache.get(key);
      if (m && m.exp > now) return m.value;
      return null;
    }

    async function setToStore(value: string): Promise<void> {
      try {
        const r = await ensureRedis();
        await r.setex(`idem:${key}`, ttlSeconds, value);
        return;
      } catch (e) {
        // in-memory fallback
        memoryCache.set(key, { value, exp: now + ttlSeconds * 1000 });
      }
    }

    // 이미 처리된 요청인지 확인
    const cached = await getFromStore();
    if (cached) {
      // 필요 시 JSON을 복원해서 동일 응답
      return res.status(200).json(JSON.parse(cached));
    }

    // 응답 가로채기
    const originalJson = res.json.bind(res);
    (res as any).json = ((body: any) => {
      // 성공만 캐시(원한다면 범위 조정)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setToStore(JSON.stringify(body)).catch(() => {});
      }
      return originalJson(body);
    }) as any;

    next();
  };
};
