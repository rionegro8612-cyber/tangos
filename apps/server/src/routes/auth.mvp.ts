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
import { checkRate, setOtp, getOtp, delOtp, readIntFromEnv } from "../services/otp.redis";
import { validate as uuidValidate } from "uuid";

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
      const { phone } = (req.body || {}) as { phone?: string };
      if (!phone) {
        return res.status(400).json({
          success: false,
          code: "BAD_REQUEST",
          message: "phone required",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "0.0.0.0";

      // 환경변수에서 설정값 가져오기
      const PHONE_LIMIT = readIntFromEnv("OTP_RATE_PER_PHONE", 5);
      const PHONE_WIN   = readIntFromEnv("OTP_RATE_PHONE_WINDOW", 600);
      const IP_LIMIT    = readIntFromEnv("OTP_RATE_PER_IP", 20);
      const IP_WIN      = readIntFromEnv("OTP_RATE_IP_WINDOW", 3600);
      const TTL         = readIntFromEnv("OTP_TTL_SEC", 300);

      // 레이트리밋 체크
      const okPhone = await checkRate(`rl:phone:${phone}`, PHONE_LIMIT, PHONE_WIN);
      const okIp    = await checkRate(`rl:ip:${ip}`,     IP_LIMIT,   IP_WIN);
      if (!okPhone || !okIp) {
        return res.status(429).json({
          success: false,
          code: "OTP_RATE_LIMIT",
          message: "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
          data: { retryAfterSec: 60 },
          requestId: (req as any).requestId ?? null,
        });
      }

      // OTP 코드 생성 및 저장
      const code = ("" + Math.floor(100000 + Math.random() * 900000));
      await setOtp(phone, code, TTL);

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
      
      return res.ok(data, "OTP_SENT");
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
      const { phone, code } = (req.body || {}) as { phone?: string; code?: string };
      if (!phone || !code) {
        return res.status(400).json({
          success: false,
          code: "BAD_REQUEST",
          message: "phone & code required",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      const saved = await getOtp(phone);
      if (!saved) {
        return res.status(400).json({
          success: false,
          code: "OTP_EXPIRED",
          message: "코드가 만료되었거나 존재하지 않습니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }
      
      if (saved !== String(code)) {
        return res.status(400).json({
          success: false,
          code: "OTP_MISMATCH",
          message: "코드가 올바르지 않습니다.",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      // OTP 코드 삭제 (재사용 방지)
      await delOtp(phone);

      const userId = await findOrCreateUserByPhoneE164(phone);
      
      // UUID 검증 (findOrCreateUserByPhoneE164에서 반환된 값 검증)
      if (!userId || !uuidValidate(userId)) {
        return res.status(500).json({
          success: false,
          code: "INTERNAL_ERROR",
          message: "사용자 ID 생성 실패",
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }
      
      await touchLastLogin(userId);

      // Access 토큰 발급
      const jti = newJti();
      const accessToken = signAccessToken(userId, jti);

      // 쿠키 사용 여부(AUTH_COOKIE=1) — 기본은 켜져있다고 가정
      if (String(process.env.AUTH_COOKIE || "1") === "1") {
        res.cookie("access_token", accessToken, accessCookieOptions());
        return res.ok({ userId }, "LOGIN_OK");
      }

      // 쿠키 비활성화 모드라면 토큰을 바디로 반환
      return res.ok({ accessToken, userId }, "LOGIN_OK");
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

