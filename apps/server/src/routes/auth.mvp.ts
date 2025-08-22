// apps/server/src/routes/auth.mvp.ts
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { issueCode, verifyCode } from "../auth/sms/otpRepo";
import {
  findOrCreateUserByPhoneE164,
  getUserProfile,
  touchLastLogin,
} from "../repos/userRepo";
import { signAccessToken, verifyAccessToken, newJti } from "../lib/jwt";
import { checkRate, setOtp, getOtp, delOtp, readIntFromEnv, getRateLimitInfo, rlIncr } from "../services/otp.redis";
import { validate as uuidValidate } from "uuid";
import { logOtpSend, logOtpVerify } from "../lib/logger";
import { 
  recordOtpSend, 
  recordOtpVerify, 
  recordRateLimitExceeded,
  recordUserRegistration,
  recordUserLogin 
} from "../lib/metrics"; // 🆕 Added: 메트릭 함수들

// 🆕 환경변수 상수 추가
const TTL = readIntFromEnv("OTP_TTL", 300); // 5분
const PHONE_LIMIT = readIntFromEnv("OTP_RATE_PER_PHONE", 5);
const PHONE_WIN = readIntFromEnv("OTP_RATE_PHONE_WINDOW", 600); // 10분
const IP_LIMIT = readIntFromEnv("OTP_RATE_PER_IP", 20);
const IP_WIN = readIntFromEnv("OTP_RATE_IP_WINDOW", 3600); // 1시간

export const authRouter = Router();

/** Authorization: Bearer 또는 httpOnly cookie에서 access 토큰 추출 */
function getTokenFromReq(req: Request) {
  const hdr = req.headers.authorization || "";
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || (req.cookies?.access_token as string | undefined);
}

/** Access-Token 쿠키 옵션(프로덕션 모드 강화) */
function accessCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  
  // 보안 설정 (프로덕션에서는 강화)
  const secure = String(process.env.COOKIE_SECURE || (isProduction ? "true" : "false")).toLowerCase() === "true";
  const domain = process.env.COOKIE_DOMAIN || undefined;
  const maxMin = Number(process.env.JWT_ACCESS_EXPIRES_MIN || 30);
  
  // SameSite 설정 (프로덕션에서는 환경변수 우선)
  let sameSite: "lax" | "none" | "strict";
  if (process.env.COOKIE_SAMESITE) {
    const envSameSite = process.env.COOKIE_SAMESITE.toLowerCase();
    if (envSameSite === "lax" || envSameSite === "none" || envSameSite === "strict") {
      sameSite = envSameSite;
    } else {
      sameSite = "lax";
    }
  } else if (secure) {
    // HTTPS에서는 none (크로스사이트 지원)
    sameSite = "none";
  } else {
    // HTTP에서는 lax (보안과 호환성 균형)
    sameSite = "lax";
  }
  
  // 프로덕션에서 SameSite=none일 때 secure=true 필수
  if (sameSite === "none" && !secure) {
    console.warn("[COOKIE] SameSite=none requires secure=true in production");
    sameSite = "lax"; // 자동으로 lax로 변경
  }
  
  return {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: "/",
    maxAge: maxMin * 60 * 1000,
  };
}

/** POST /api/v1/auth/send-sms */
authRouter.post(
  "/send-sms",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startTime = Date.now();
      const { phone, carrier, context } = (req.body || {}) as { phone?: string; carrier?: string; context?: string; };
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "0.0.0.0";

      if (!phone || !carrier || !context) {
        // 🆕 메트릭: OTP 전송 실패 (잘못된 요청)
        recordOtpSend('fail', 'SENS', carrier || 'unknown');
        
        return res.status(400).json({
          success: false,
          code: "BAD_REQUEST",
          message: "phone, carrier, context required",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // 🚨 레이트리밋 체크 (간단한 형태로 복원)
      const phoneKey = `rl:phone:${phone}`;
      const ipKey = `rl:ip:${ip}`;
      
      // 기본 레이트리밋 체크 (기존 방식)
      const okPhone = await checkRate(phoneKey, PHONE_LIMIT, PHONE_WIN);
      const okIp = await checkRate(ipKey, IP_LIMIT, IP_WIN);
      
      if (!okPhone || !okIp) {
        // 🆕 메트릭: 레이트리밋 초과
        if (!okPhone) {
          recordRateLimitExceeded('phone', 'otp_send');
        }
        if (!okIp) {
          recordRateLimitExceeded('ip', 'otp_send');
        }
        
        return res.status(429).json({
          success: false,
          code: "RATE_LIMITED",
          message: "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // OTP 코드 생성 및 저장
      const code = ("" + Math.floor(100000 + Math.random() * 900000));
      await setOtp(phone, code, TTL);

      // 성공 시 레이트리밋 헤더 설정 (간단한 형태)
      res.set({
        'X-RateLimit-Limit': Math.max(PHONE_LIMIT, IP_LIMIT).toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.max(PHONE_WIN, IP_WIN).toString()
      });

      // 개발 환경에서만 코드 표시
      const isDev = process.env.NODE_ENV !== "production";
      const includeDevCode = isDev || String(req.query.dev ?? "").trim() === "1";

      const data: any = { 
        phoneE164: phone, 
        expiresInSec: TTL,
        ...(includeDevCode ? { devCode: code } : {})
      };
      
      if (includeDevCode) {
        console.log(`[DEV][OTP] ${phone} -> ${code} (ttl=${TTL}s)`);
      }

      // 🆕 메트릭: OTP 전송 성공
      recordOtpSend('success', 'SENS', carrier);

      // 성공 로깅
      const latencyMs = Date.now() - startTime;
      logOtpSend(
        'success',
        'OTP_SENT',
        200,
        req.requestId,
        phone,
        ip,
        'SENS',
        undefined,
        {
          scope: 'combo',
          limit: Math.max(PHONE_LIMIT, IP_LIMIT),
          remaining: 0,
          reset_sec: Math.max(PHONE_WIN, IP_WIN)
        },
        latencyMs
      );
      
      return res.ok(data, "OTP_SENT");
    } catch (e) {
      // 🆕 메트릭: OTP 전송 실패 (시스템 오류)
      recordOtpSend('fail', 'SENS', 'unknown');
      next(e);
    }
  }
);

/** POST /api/v1/auth/verify-code  — 로그인(쿠키에 Access JWT만 심음) */
authRouter.post(
  "/verify-code",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startTime = Date.now();
      const { phone, code, context } = (req.body || {}) as { phone?: string; code?: string; context?: string; };
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "0.0.0.0";

      if (!phone || !code || !context) {
        // 🆕 메트릭: OTP 검증 실패 (잘못된 요청)
        recordOtpVerify('fail', 'BAD_REQUEST');
        
        return res.status(400).json({
          success: false,
          code: "BAD_REQUEST",
          message: "phone, code, context required",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // OTP 검증
      const storedCode = await getOtp(phone);
      
      if (!storedCode) {
        // 🆕 메트릭: OTP 검증 실패 (코드 만료)
        recordOtpVerify('fail', 'EXPIRED');
        
        return res.status(400).json({
          success: false,
          code: "EXPIRED",
          message: "인증번호가 만료되었습니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      if (storedCode !== code) {
        // 🆕 메트릭: OTP 검증 실패 (잘못된 코드)
        recordOtpVerify('fail', 'INVALID_CODE');
        
        return res.status(400).json({
          success: false,
          code: "INVALID_CODE",
          message: "잘못된 인증번호입니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // OTP 사용 후 삭제
      await delOtp(phone);

      // 🆕 메트릭: OTP 검증 성공
      recordOtpVerify('success', 'VALID_CODE');

      // 성공 로깅
      const latencyMs = Date.now() - startTime;
      logOtpSend(
        'success',
        'OTP_VERIFIED',
        200,
        req.requestId,
        phone,
        ip,
        'SENS',
        undefined,
        undefined,
        latencyMs
      );

      return res.ok({ verified: true }, "OTP_VERIFIED");
    } catch (e) {
      // 🆕 메트릭: OTP 검증 실패 (시스템 오류)
      recordOtpVerify('fail', 'SYSTEM_ERROR');
      next(e);
    }
  }
);

/** POST /api/v1/auth/logout — Access 쿠키만 제거 */
authRouter.post(
  "/logout",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const opts = accessCookieOptions();
      res.clearCookie("access_token", { ...opts, expires: new Date(0) });
      return res.ok({}, "LOGOUT_OK");
    } catch (e) {
      next(e);
    }
  }
);

/** GET /api/v1/auth/me — 쿠키(or Bearer)에서 Access 검증 */
authRouter.get(
  "/me",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = getTokenFromReq(req);
      if (!token) {
        return res.status(401).json({
          success: false,
          code: "UNAUTHORIZED",
          message: "missing token",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      const decoded: any = verifyAccessToken(token);
      const userId = String(decoded?.uid);
      
      // UUID 형식 검증 (uuidValidate 사용)
      if (!userId || !uuidValidate(userId)) {
        return res.status(401).json({
          success: false,
          code: "UNAUTHORIZED",
          message: "invalid token",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      const user = await getUserProfile(userId);
      return res.ok({ user }, "ME_OK");
    } catch (e) {
      next(e);
    }
  }
);

// 호환성 위해 default export도 제공
export default authRouter;

