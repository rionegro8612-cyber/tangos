import { redis } from "../lib/redis";

const memOTP = new Map<string, { code: string; exp: number }>();
const memRL  = new Map<string, { n: number; exp: number }>();

function now() { return Date.now(); }

function parseIntSafe(v: any, d: number) {
  const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : d;
}

async function rlIncr(key: string, windowSec: number): Promise<number> {
  try {
    if (redis && (redis as any).isOpen) {
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, windowSec);
      return n;
    }
  } catch (e) {
    console.warn("[rate-limit] redis error:", (e as any)?.message);
  }
  // memory fallback
  const item = memRL.get(key);
  const exp  = now() + windowSec * 1000;
  if (!item || item.exp < now()) {
    memRL.set(key, { n: 1, exp });
    return 1;
  } else {
    item.n += 1;
    return item.n;
  }
}

export async function checkRate(key: string, limit: number, windowSec: number): Promise<boolean> {
  const n = await rlIncr(key, windowSec);
  return n <= limit;
}

export async function setOtp(phone: string, code: string, ttlSec: number) {
  try {
    if (redis && (redis as any).isOpen) {
      await redis.set(`otp:${phone}:code`, code, { EX: ttlSec });
      return;
    }
  } catch (e) {
    console.warn("[otp] redis set error:", (e as any)?.message);
  }
  memOTP.set(phone, { code, exp: now() + ttlSec * 1000 });
}

export async function getOtp(phone: string): Promise<string | null> {
  try {
    if (redis && (redis as any).isOpen) {
      return (await redis.get(`otp:${phone}:code`)) as string | null;
    }
  } catch (e) {
    console.warn("[otp] redis get error:", (e as any)?.message);
  }
  const m = memOTP.get(phone);
  if (!m || m.exp < now()) return null;
  return m.code;
}

export async function delOtp(phone: string) {
  try {
    if (redis && (redis as any).isOpen) {
      await redis.del(`otp:${phone}:code`);
      return;
    }
  } catch (e) {
    console.warn("[otp] redis del error:", (e as any)?.message);
  }
  memOTP.delete(phone);
}

export function readIntFromEnv(name: string, dflt: number) {
  return parseIntSafe(process.env[name], dflt);
}
