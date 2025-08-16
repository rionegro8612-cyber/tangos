// Minimal placeholder for Redis-based token bucket.
// Wire up to ioredis or redis client in your stack.
import { Request, Response, NextFunction } from "express";

export function rateLimit(options: { key: (req: Request) => string, limit: number, windowSec: number }) {
  const memory: Record<string, { count: number; resetAt: number }> = {};
  return (req: Request, res: Response, next: NextFunction) => {
    const k = options.key(req);
    const now = Date.now();
    const entry = memory[k] && memory[k].resetAt > now
      ? memory[k]
      : (memory[k] = { count: 0, resetAt: now + options.windowSec * 1000 });
    entry.count += 1;
    if (entry.count > options.limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.fail("RATE_LIMITED", "Too many requests", 429);
    }
    next();
  };
}
