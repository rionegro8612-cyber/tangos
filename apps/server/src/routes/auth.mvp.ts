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

export const authRouter = Router();

/** Authorization: Bearer 또는 httpOnly cookie에서 access 토큰 추출 */
function getTokenFromReq(req: Request) {
  const hdr = req.headers.authorization || "";
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || (req.cookies?.access_token as string | undefined);
}

/** Access-Token 쿠키 옵션(간단 버전) */
function accessCookieOptions() {
  const secure = String(process.env.COOKIE_SECURE || "false").toLowerCase() === "true";
  const domain = process.env.COOKIE_DOMAIN || undefined;
  const maxMin = Number(process.env.JWT_ACCESS_EXPIRES_MIN || 30);
  return {
    httpOnly: true,
    secure,                         // 로컬 HTTP면 false, HTTPS 배포면 true
    sameSite: secure ? "none" as const : "lax" as const,
    domain,                         // 필요 없으면 undefined 유지
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

      const forceDev = String(req.query.dev ?? "").trim() === "1";
      const r = await issueCode(phone, { forceDev });

      if (!r.ok) {
        return res.status(429).json({
          success: false,
          code: r.code,
          message: r.message,
          data: { retryAfterSec: (r as any).retryAfterSec ?? 60 },
          requestId: (req as any).requestId ?? null,
        });
      }

      const providerIsMock =
        String(process.env.SMS_PROVIDER || "").trim().toLowerCase() === "mock";
      const debugOtpOn = ["1", "true", "yes", "on"].includes(
        String(process.env.DEBUG_OTP ?? "").trim().toLowerCase()
      );
      const includeDev = forceDev || providerIsMock || debugOtpOn;

      const data: any = { phoneE164: r.phoneE164, expiresInSec: r.expiresInSec };
      if (includeDev && (r as any)._codeForDev) {
        data.devCode = (r as any)._codeForDev;
        console.log(`[DEV][OTP] ${r.phoneE164} -> ${(r as any)._codeForDev}`);
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

      const r = await verifyCode(phone, code);
      if (!r.ok) {
        return res.status(400).json({
          success: false,
          code: r.code,
          message: r.message,
          data: null,
          requestId: (req as any).requestId ?? null,
        });
      }

      const userId = await findOrCreateUserByPhoneE164(r.phoneE164!);
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
      const userId = Number(decoded?.uid);
      if (!userId) {
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

