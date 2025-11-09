import { getRedis } from "../lib/redis";

const OTP_TTL_SEC = 300;
const OTP_PREFIX  = "otp";
const CD_PREFIX   = "otp:cooldown";

const normalizePhone = (phone: string) => {
  // 이미 +82로 시작하는 경우 그대로 반환
  if (phone.startsWith("+82")) {
    return phone;
  }
  
  const digits = phone.replace(/\D/g, ""); // 숫자만 추출
  if (digits.startsWith("0")) {
    return `+82${digits.substring(1)}`; // 0 제거하고 +82 추가
  }
  if (digits.startsWith("82")) {
    return `+${digits}`; // 82로 시작하면 + 추가
  }
  return `+82${digits}`; // 나머지는 +82 추가
};

const otpKey = (phoneE164: string, context = "register") => {
  const normalized = normalizePhone(phoneE164);
  const key = `${OTP_PREFIX}:${context}:${normalized}`;
  console.log(`[OTP:KEY] 생성된 키: ${key} (원본: ${phoneE164})`);
  return key;
};

const cdKey  = (phoneE164: string, context = "register") =>
  `${CD_PREFIX}:${context}:${normalizePhone(phoneE164)}`;

// 쿨다운 키 생성 함수 export (다른 모듈에서 사용)
export function getCooldownKey(phoneE164: string, context = "register"): string {
  return cdKey(phoneE164, context);
}

export async function issueOtp(phoneE164: string, code: string, context = "register") {
  try {
    const r = getRedis();
    const key = otpKey(phoneE164, context);
    console.log(`[otp] issueOtp 시작: ${key}, code: ${code}, ttl: ${OTP_TTL_SEC}`);
    
    // ioredis 문법: setex(key, seconds, value)
    const ok = await r.setex(key, OTP_TTL_SEC, code);
    console.log(`[otp] setex 결과: ${ok} (type: ${typeof ok})`);
    
    if (ok !== "OK") {
      console.error(`[otp] Redis SET 실패: ${key}, 결과: ${ok}`);
      throw new Error(`Redis SET failed: ${ok}`);
    }
    
    console.log(`[otp] Redis set success: ${key} (TTL: ${OTP_TTL_SEC}s)`);
    return { key, expiresIn: OTP_TTL_SEC };
  } catch (error) {
    console.error(`[otp] issueOtp 오류:`, error);
    throw error;
  }
}

export async function verifyOtp(phoneE164: string, code: string, context = "register") {
  const r = getRedis();
  const key = otpKey(phoneE164, context);
  const saved = await r.get(key);
  console.log(`[otp] Redis get: ${key} -> ${saved ? 'found' : 'not found'}`);
  
  if (!saved) return { ok: false, code: "EXPIRED" as const };
  if (saved !== code) return { ok: false, code: "MISMATCH" as const };
  
  await r.del(key);
  console.log(`[otp] Redis del success: ${key}`);
  return { ok: true as const };
}

export async function checkAndMarkCooldown(phoneE164: string, context = "register", sec = 60) {
  const r = getRedis();
  const key = cdKey(phoneE164, context);
  // ioredis 문법: set(key, value, "EX", seconds, "NX")
  const ok = await r.set(key, "1", "EX", sec, "NX");
  console.log(`[otp] Cooldown check: ${key} -> ${ok === "OK" ? "allowed" : "blocked"}`);
  
  // 기존 코드와의 호환성을 위해 객체 형태로 반환
  if (ok === "OK") {
    return { blocked: false, retryAfter: 0 };
  } else {
    const ttl = await r.ttl(key);
    return { blocked: true, retryAfter: ttl > 0 ? ttl : sec };
  }
}

// 기존 코드와의 호환성을 위한 함수들
export async function setOtp(phone: string, code: string, context = "register", ttlSec = OTP_TTL_SEC) {
  return await issueOtp(phone, code, context);
}

export async function getOtp(phone: string, context = "register") {
  try {
    const r = getRedis();
    const key = otpKey(phone, context);
    const code = await r.get(key);
    return { code, error: undefined };
  } catch (error) {
    return { code: null, error: (error as any)?.message };
  }
}

export async function delOtp(phone: string, context = "register") {
  const r = getRedis();
  const key = otpKey(phone, context);
  await r.del(key);
  return { success: true };
}

// fetchOtp 함수 (기존 코드용) - 객체 형태로 반환
export async function fetchOtp(phone: string, context = "register") {
  const r = getRedis();
  const key = otpKey(phone, context);
  const code = await r.get(key);
  const ttl = await r.ttl(key);
  
  return {
    exists: code !== null,
    expired: code === null,
    ttl: ttl,
    code: code
  };
}
