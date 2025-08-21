import { redis } from "../lib/redis";
import crypto from "crypto";

/**
 * Redis 기반 OTP 서비스
 * - 레이트리밋 (전화번호/IP 기준)
 * - 코드 자동 무효화 (새 발급 시 이전 코드 덮어쓰기)
 * - 재사용 방지 (검증 성공 시 즉시 삭제)
 */

// 환경 변수에서 설정값 가져오기
const OTP_TTL_SEC = Number(process.env.OTP_TTL_SEC ?? 300);
const PHONE_LIMIT = Number(process.env.OTP_RATE_PER_PHONE ?? 5);
const PHONE_WINDOW = Number(process.env.OTP_RATE_PHONE_WINDOW ?? 600);
const IP_LIMIT = Number(process.env.OTP_RATE_PER_IP ?? 20);
const IP_WINDOW = Number(process.env.OTP_RATE_IP_WINDOW ?? 3600);

/**
 * 6자리 랜덤 코드 생성
 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 레이트리밋 체크 (INCR + EXPIRE 패턴)
 */
async function checkRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  return count <= limit;
}

/**
 * OTP 발급 (레이트리밋 체크 포함)
 */
export async function issueOtpCode(phone: string, ip: string): Promise<{
  success: boolean;
  code?: string;
  message: string;
  ttlSec: number;
  retryAfterSec?: number;
}> {
  try {
    // 전화번호별 레이트리밋 체크
    const phoneKey = `rl:phone:${phone}`;
    const phoneOk = await checkRateLimit(phoneKey, PHONE_LIMIT, PHONE_WINDOW);
    
    if (!phoneOk) {
      const ttl = await redis.ttl(phoneKey);
      return {
        success: false,
        message: "전화번호별 요청 한도를 초과했습니다",
        ttlSec: OTP_TTL_SEC,
        retryAfterSec: ttl
      };
    }

    // IP별 레이트리밋 체크
    const ipKey = `rl:ip:${ip}`;
    const ipOk = await checkRateLimit(ipKey, IP_LIMIT, IP_WINDOW);
    
    if (!ipOk) {
      const ttl = await redis.ttl(ipKey);
      return {
        success: false,
        message: "IP별 요청 한도를 초과했습니다",
        ttlSec: OTP_TTL_SEC,
        retryAfterSec: ttl
      };
    }

    // 새로운 OTP 코드 생성
    const code = generateCode();
    const otpKey = `otp:${phone}:code`;
    
    // 같은 키에 덮어쓰기 → 이전 코드 자동 무효화
    await redis.set(otpKey, code, { EX: OTP_TTL_SEC });

    return {
      success: true,
      code,
      message: "OTP 코드가 발급되었습니다",
      ttlSec: OTP_TTL_SEC
    };
  } catch (error) {
    console.error("[OTP Redis] 발급 실패:", error);
    return {
      success: false,
      message: "OTP 발급 중 오류가 발생했습니다",
      ttlSec: OTP_TTL_SEC
    };
  }
}

/**
 * OTP 코드 검증
 */
export async function verifyOtpCode(phone: string, code: string): Promise<{
  success: boolean;
  message: string;
  phoneE164?: string;
}> {
  try {
    const otpKey = `otp:${phone}:code`;
    const savedCode = await redis.get(otpKey);
    
    if (!savedCode) {
      return {
        success: false,
        message: "코드가 만료되었거나 존재하지 않습니다"
      };
    }

    if (savedCode !== code) {
      return {
        success: false,
        message: "코드가 올바르지 않습니다"
      };
    }

    // 검증 성공 → 즉시 삭제 (재사용 방지)
    await redis.del(otpKey);

    return {
      success: true,
      message: "코드가 확인되었습니다",
      phoneE164: phone
    };
  } catch (error) {
    console.error("[OTP Redis] 검증 실패:", error);
    return {
      success: false,
      message: "코드 검증 중 오류가 발생했습니다"
    };
  }
}

/**
 * OTP 코드 상태 확인 (디버깅용)
 */
export async function getOtpStatus(phone: string): Promise<{
  exists: boolean;
  ttl: number;
  code?: string;
}> {
  try {
    const otpKey = `otp:${phone}:code`;
    const code = await redis.get(otpKey);
    const ttl = await redis.ttl(otpKey);
    
    return {
      exists: !!code,
      ttl: ttl > 0 ? ttl : 0,
      code: code || undefined
    };
  } catch (error) {
    console.error("[OTP Redis] 상태 확인 실패:", error);
    return { exists: false, ttl: 0 };
  }
}

/**
 * 레이트리밋 상태 확인 (디버깅용)
 */
export async function getRateLimitStatus(phone: string, ip: string): Promise<{
  phone: { count: number; ttl: number };
  ip: { count: number; ttl: number };
}> {
  try {
    const phoneKey = `rl:phone:${phone}`;
    const ipKey = `rl:ip:${ip}`;
    
    const [phoneCount, phoneTtl, ipCount, ipTtl] = await Promise.all([
      redis.get(phoneKey),
      redis.ttl(phoneKey),
      redis.get(ipKey),
      redis.ttl(ipKey)
    ]);

    return {
      phone: {
        count: Number(phoneCount) || 0,
        ttl: phoneTtl > 0 ? phoneTtl : 0
      },
      ip: {
        count: Number(ipCount) || 0,
        ttl: ipTtl > 0 ? ipTtl : 0
      }
    };
  } catch (error) {
    console.error("[OTP Redis] 레이트리밋 상태 확인 실패:", error);
    return {
      phone: { count: 0, ttl: 0 },
      ip: { count: 0, ttl: 0 }
    };
  }
}
