// apps/server/src/routes/auth.mvp.ts
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { issueCode, verifyCode } from "../auth/sms/otpRepo";
import {
  findOrCreateUserByPhoneE164,
  getUserProfile,
  touchLastLogin,
  findByPhone,
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

/** 전화번호 마스킹 함수 */
function phoneMasked(phone: string): string {
  if (!phone || phone.length < 4) return phone;
  return phone.slice(0, 3) + '*'.repeat(phone.length - 4) + phone.slice(-1);
}

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
        cooldown: 60, // 재전송 쿨다운 (1분)
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
        phoneMasked(phone),
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

/** POST /api/v1/auth/resend-sms */
authRouter.post(
  "/resend-sms",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startTime = Date.now();
      const { phone, carrier, context } = (req.body || {}) as { phone?: string; carrier?: string; context?: string; };
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "0.0.0.0";

      if (!phone || !carrier || !context) {
        return res.status(400).json({
          success: false,
          code: "BAD_REQUEST",
          message: "phone, carrier, context required",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // 재전송 쿨다운 체크
      const cooldownKey = `cooldown:resend:${phone}`;
      const cooldown = await getOtp(cooldownKey);
      
      if (cooldown) {
        return res.status(429).json({
          success: false,
          code: "RESEND_BLOCKED",
          message: "잠시 후 재전송해주세요.",
          data: { retryAfter: 60 },
          requestId: (req as any).requestId ?? null,
        });
      }

      // 쿨다운 설정 (1분)
      await setOtp(cooldownKey, "1", 60);

      // OTP 코드 생성 및 저장
      const code = ("" + Math.floor(100000 + Math.random() * 900000));
      await setOtp(phone, code, TTL);

      // 개발 환경에서만 코드 표시
      const isDev = process.env.NODE_ENV !== "production";
      const includeDevCode = isDev || String(req.query.dev ?? "").trim() === "1";

      const data: any = { 
        phoneE164: phone, 
        expiresInSec: TTL,
        retryAfter: 60, // 재전송 쿨다운 (1분)
        ...(includeDevCode ? { devCode: code } : {})
      };
      
      if (includeDevCode) {
        console.log(`[DEV][OTP] ${phone} -> ${code} (ttl=${TTL}s) - RESEND`);
      }

      // 🆕 메트릭: OTP 재전송 성공
      recordOtpSend('success', 'SENS', carrier);

      return res.ok(data, "OTP_RESENT");
    } catch (e) {
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
        
        return res.status(410).json({
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
        
        return res.status(401).json({
          success: false,
          code: "INVALID_CODE",
          message: "잘못된 인증번호입니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // OTP 사용 후 삭제
      await delOtp(phone);

      // 사용자 존재 여부 확인 (isNew 필드 결정)
      const existingUser = await findByPhone(phone);
      const isNew = !existingUser; // 사용자가 없으면 신규 사용자

      // 가입 티켓 발급 (신규 사용자인 경우)
      if (isNew) {
        const ticketKey = `reg:ticket:${phone}`;
        const ticketData = {
          phone,
          verifiedAt: new Date().toISOString(),
          attempts: 1
        };
        // 가입 티켓을 Redis에 저장 (30분 TTL)
        await setOtp(ticketKey, JSON.stringify(ticketData), 1800);
      }

      // 🆕 메트릭: OTP 검증 성공
      recordOtpVerify('success', 'VALID_CODE');

      // 성공 로깅
      const latencyMs = Date.now() - startTime;
      logOtpVerify(
        'success',
        'OTP_VERIFIED',
        200,
        req.requestId,
        phoneMasked(phone),
        ip,
        undefined,
        latencyMs
      );

      // 응답 메시지 결정
      const message = isNew ? "SIGNUP_REQUIRED" : "LOGIN_OK";
      
      return res.ok({ 
        verified: true, 
        isNew,
        ...(isNew ? {
          registrationTicket: {
            expiresIn: 1800, // 30분
            message: "Phone verified. You can now complete registration."
          }
        } : {})
      }, message);
    } catch (e) {
      // 🆕 메트릭: OTP 검증 실패 (시스템 오류)
      recordOtpVerify('fail', 'SYSTEM_ERROR');
      next(e);
    }
  }
);

/** POST /api/v1/auth/test/expire-otp - 테스트용 OTP 만료 엔드포인트 */
authRouter.post(
  "/test/expire-otp",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone } = (req.body || {}) as { phone?: string; };
      
      if (!phone) {
        return res.status(400).json({
          success: false,
          code: "BAD_REQUEST",
          message: "phone required",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // 개발 환경에서만 허용
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({
          success: false,
          code: "FORBIDDEN",
          message: "테스트 엔드포인트는 개발 환경에서만 사용 가능합니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // OTP 강제 만료 (TTL을 1초로 설정)
      await setOtp(phone, "EXPIRED", 1);
      
      console.log(`[TEST] OTP 강제 만료: ${phone}`);
      
      return res.status(200).json({
        success: true,
        code: "OK",
        message: "OTP가 강제로 만료되었습니다.",
        data: { phone, expiresIn: 1 },
        requestId: (req as any).requestId ?? null,
      });
    } catch (e) {
      next(e);
    }
  }
);

/** POST /api/v1/auth/signup - 최종 1회 제출(약관 동의 시점) */
authRouter.post(
  "/signup",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone, code, context } = (req.body || {}) as { phone?: string; code?: string; context?: string; };

      if (!phone || !code || !context) {
        return res.status(400).json({
          success: false,
          code: "BAD_REQUEST",
          message: "phone, code, context required",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // OTP 재검증
      const storedCode = await getOtp(phone);
      
      if (!storedCode) {
        return res.status(410).json({
          success: false,
          code: "EXPIRED",
          message: "인증번호가 만료되었습니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      if (storedCode !== code) {
        return res.status(401).json({
          success: false,
          code: "INVALID_CODE",
          message: "잘못된 인증번호입니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // 가입 티켓 확인
      const ticketKey = `reg:ticket:${phone}`;
      const ticketData = await getOtp(ticketKey);
      
      if (!ticketData) {
        return res.status(400).json({
          success: false,
          code: "REGISTRATION_EXPIRED",
          message: "가입 티켓이 만료되었습니다. 다시 인증해주세요.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // 가입 티켓 삭제
      await delOtp(ticketKey);

      // 사용자 존재 여부 확인
      const existingUser = await findByPhone(phone);
      
      if (existingUser) {
        return res.status(409).json({
          success: false,
          code: "USER_EXISTS",
          message: "이미 등록된 사용자입니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }
      
      // 새 사용자 생성 (여기서는 생성하지 않음, 별도 로직 필요)
      // TODO: 실제 사용자 생성 로직 구현
      const user = { id: "temp", phone };
      
      // 🆕 메트릭: 사용자 가입
      recordUserRegistration('success');

      // 성공 응답
      return res.ok({ 
        user,
        message: "Registration completed successfully"
      }, "SIGNUP_COMPLETED");
      
    } catch (e) {
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

