import { ensureRedis } from "../lib/redis";

const memOTP = new Map<string, { code: string; exp: number }>();
const memRL = new Map<string, { n: number; exp: number }>();

const OTP_TTL_SEC = 300;
const OTP_PREFIX = "otp";

function now() {
  return Date.now();
}

function parseIntSafe(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : d;
}

function normalizePhone(e164: string) {
  return e164.replace(/\s+/g, "");
}

function otpKey(phoneE164: string, context = "register") {
  return `${OTP_PREFIX}:${context}:${normalizePhone(phoneE164)}`;
}

export async function rlIncr(key: string, windowSec: number): Promise<number> {
  try {
    const redis = await ensureRedis();
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, windowSec);
    console.log(`[rate-limit] Redis: ${key} -> ${n}`);
    return n;
  } catch (e) {
    console.warn("[rate-limit] redis error:", (e as any)?.message);
  }

  // 🚨 메모리 폴백 로직 수정 및 디버깅
  const item = memRL.get(key);
  const currentTime = now();
  const exp = currentTime + windowSec * 1000;

  console.log(`[rate-limit] Memory fallback for ${key}:`, {
    existing: item ? { n: item.n, exp: item.exp, current: currentTime } : null,
    windowSec,
    newExp: exp,
  });

  if (!item || item.exp < currentTime) {
    // 새로운 윈도우 시작
    const newItem = { n: 1, exp };
    memRL.set(key, newItem);
    console.log(`[rate-limit] New window: ${key} -> 1 (exp: ${exp})`);
    return 1;
  } else {
    // 기존 윈도우에서 카운터 증가
    item.n += 1;
    console.log(`[rate-limit] Increment: ${key} -> ${item.n} (exp: ${item.exp})`);
    return item.n;
  }
}

export async function checkRate(key: string, limit: number, windowSec: number): Promise<boolean> {
  const n = await rlIncr(key, windowSec);
  return n <= limit;
}

// 레이트리밋 상세 정보 반환 함수 추가
export async function getRateLimitInfo(
  key: string,
  limit: number,
  windowSec: number,
): Promise<{
  current: number;
  limit: number;
  remaining: number;
  resetSec: number;
  isExceeded: boolean;
}> {
  try {
    const redis = await ensureRedis();
    const current = await redis.get(key);
    const n = current ? parseInt(current) : 0;
    const ttl = await redis.ttl(key);
    const resetSec = ttl > 0 ? ttl : windowSec;

    return {
      current: n,
      limit,
      remaining: Math.max(0, limit - n),
      resetSec,
      isExceeded: n > limit,
    };
  } catch (e) {
    console.warn("[rate-limit] redis error:", (e as any)?.message);
  }

  // memory fallback
  const item = memRL.get(key);
  if (!item || item.exp < now()) {
    return {
      current: 0,
      limit,
      remaining: limit,
      resetSec: windowSec,
      isExceeded: false,
    };
  }

  return {
    current: item.n,
    limit,
    remaining: Math.max(0, limit - item.n),
    resetSec: Math.ceil((item.exp - now()) / 1000),
    isExceeded: item.n > limit,
  };
}

export async function setOtp(phone: string, code: string, context = "register", ttlSec = OTP_TTL_SEC): Promise<{ success: boolean; error?: string }> {
  console.log(`[otp] setOtp 호출됨: ${phone}, code: ${code}, context: ${context}, ttl: ${ttlSec}s`);
  
  // Fail-Fast: Redis 연결 실패 시 즉시 에러
  if (process.env.NODE_ENV !== "test") {
    const redis = await ensureRedis();
    console.log(`[otp] Redis 클라이언트 획득됨: ${redis ? 'OK' : 'NULL'}`);
    const key = otpKey(phone, context);
    await redis.setex(key, ttlSec, code);
    console.log(`[otp] Redis set success: ${key} (TTL: ${ttlSec}s)`);
    return { success: true };
  }
  
  // 테스트 환경에서만 메모리 폴백 허용
  try {
    const redis = await ensureRedis();
    const key = otpKey(phone, context);
    await redis.setex(key, ttlSec, code);
    console.log(`[otp] Redis set success: ${key} (TTL: ${ttlSec}s)`);
    return { success: true };
  } catch (e) {
    console.error("[otp] redis set error:", (e as any)?.message);
    throw new Error(`Redis set failed: ${(e as any)?.message}`);
  }
}

export async function getOtp(phone: string, context = "register"): Promise<{ code: string | null; error?: string }> {
  // Fail-Fast: Redis 연결 실패 시 즉시 에러
  if (process.env.NODE_ENV !== "test") {
    const redis = await ensureRedis();
    const key = otpKey(phone, context);
    const code = (await redis.get(key)) as string | null;
    console.log(`[otp] Redis get: ${key} -> ${code ? 'found' : 'not found'}`);
    return { code };
  }
  
  // 테스트 환경에서만 메모리 폴백 허용
  try {
    const redis = await ensureRedis();
    const key = otpKey(phone, context);
    const code = (await redis.get(key)) as string | null;
    console.log(`[otp] Redis get: ${key} -> ${code ? 'found' : 'not found'}`);
    return { code };
  } catch (e) {
    console.error("[otp] redis get error:", (e as any)?.message);
    throw new Error(`Redis get failed: ${(e as any)?.message}`);
  }
}

export async function delOtp(phone: string, context = "register"): Promise<{ success: boolean; error?: string }> {
  // Fail-Fast: Redis 연결 실패 시 즉시 에러
  if (process.env.NODE_ENV !== "test") {
    const redis = await ensureRedis();
    const key = otpKey(phone, context);
    await redis.del(key);
    console.log(`[otp] Redis del success: ${key}`);
    return { success: true };
  }
  
  // 테스트 환경에서만 메모리 폴백 허용
  try {
    const redis = await ensureRedis();
    const key = otpKey(phone, context);
    await redis.del(key);
    console.log(`[otp] Redis del success: ${key}`);
    return { success: true };
  } catch (e) {
    console.error("[otp] redis del error:", (e as any)?.message);
    throw new Error(`Redis del failed: ${(e as any)?.message}`);
  }
}

// OTP 검증 함수 추가
export async function verifyOtp(phone: string, code: string, context = "register"): Promise<{ ok: boolean; reason?: string; error?: string }> {
  try {
    const result = await getOtp(phone, context);
    
    if (result.error) {
      console.error(`[otp] verify error for ${phone}:`, result.error);
      return { ok: false, reason: "INTERNAL_ERROR", error: result.error };
    }
    
    if (!result.code) {
      console.log(`[otp] verify failed for ${phone}: EXPIRED_OR_NOT_FOUND`);
      return { ok: false, reason: "EXPIRED_OR_NOT_FOUND" };
    }
    
    if (result.code !== code) {
      console.log(`[otp] verify failed for ${phone}: MISMATCH`);
      return { ok: false, reason: "MISMATCH" };
    }
    
    // 검증 성공 시 OTP 삭제
    await delOtp(phone, context);
    console.log(`[otp] verify success for ${phone}`);
    return { ok: true };
    
  } catch (e) {
    console.error(`[otp] verify exception for ${phone}:`, (e as any)?.message);
    return { ok: false, reason: "INTERNAL_ERROR", error: (e as any)?.message };
  }
}

export function readIntFromEnv(name: string, dflt: number) {
  return parseIntSafe(process.env[name], dflt);
}
