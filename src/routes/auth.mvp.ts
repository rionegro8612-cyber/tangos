import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { issueCode, verifyCode } from "../auth/sms/otpRepo";
import { findOrCreateUserByPhoneE164, getUserProfile, touchLastLogin } from "../repos/userRepo";
import { signAccess, signRefresh, verifyToken } from "../lib/jwt";
import { storeRefresh, isRefreshValid, revokeRefresh } from "../auth/refreshRepo";

export const authRouter = Router();

/** 토큰 추출: Authorization Bearer 또는 httpOnly cookie */
function getTokenFromReq(req: Request) {
  const hdr = req.headers.authorization || "";
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || (req.cookies?.access_token as string | undefined);
}

/** 쿠키 세팅: 도메인/보안 옵션을 .env로 제어 */
function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const prod = process.env.NODE_ENV === "production";
  const secure = String(process.env.COOKIE_SECURE || "").toLowerCase() === "true" || prod;
  const domain = process.env.COOKIE_DOMAIN || undefined;
  const sameSite: "lax" | "strict" = prod ? "strict" : "lax";

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    sameSite,
    secure,
    domain,
    maxAge: Number(process.env.JWT_ACCESS_EXPIRES_MIN ?? 15) * 60 * 1000,
    path: "/",
  });
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite,
    secure,
    domain,
    maxAge: Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 14) * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

// POST /api/v1/auth/send-sms
authRouter.post("/send-sms", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "phone required",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    const r = await issueCode(phone);
    if (!r.ok) {
      return res.status(429).json({
        success: false,
        code: r.code,
        message: r.message,
        data: { retryAfterSec: r.retryAfterSec ?? 60 },
        requestId: (req as any).requestId ?? null,
      });
    }

    // 개발 환경에서만 devCode 노출
    const includeDev = process.env.DEBUG_OTP === "1";
    const data: any = { phoneE164: r.phoneE164, expiresInSec: r.expiresInSec };
    if (includeDev) data.devCode = r._codeForDev;

    return res.ok(data, "OTP_SENT");
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/auth/verify-code
authRouter.post("/verify-code", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, code } = req.body as { phone?: string; code?: string };
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

    const accessToken = signAccess({ uid: userId });
    const refreshToken = signRefresh({ uid: userId });

    // refresh 만료 시각 계산해 DB에 저장
    const decoded: any = verifyToken(refreshToken);
    const expMs =
      decoded?.exp ? decoded.exp * 1000 : Date.now() + Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 14) * 864e5;

    await storeRefresh(
      userId,
      refreshToken,
      new Date(expMs).toISOString(),
      req.headers["user-agent"] as string,
      (req.ip || req.socket?.remoteAddress || null) as any
    );

    if (process.env.AUTH_COOKIE === "1") {
      setAuthCookies(res, accessToken, refreshToken);
      return res.ok({ userId }, "LOGIN_OK");
    }
    return res.ok({ accessToken, refreshToken, userId }, "LOGIN_OK");
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/auth/refresh
authRouter.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = (req.cookies?.refresh_token as string) || (req.body?.refreshToken as string);
    if (!token) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "missing refresh token",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    const decoded: any = verifyToken(token);
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

    const valid = await isRefreshValid(userId, token);
    if (!valid) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "refresh invalid",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    const accessToken = signAccess({ uid: userId });
    if (process.env.AUTH_COOKIE === "1") {
      const prod = process.env.NODE_ENV === "production";
      res.cookie("access_token", accessToken, {
        httpOnly: true,
        sameSite: prod ? "strict" : "lax",
        secure: prod || String(process.env.COOKIE_SECURE || "").toLowerCase() === "true",
        domain: process.env.COOKIE_DOMAIN || undefined,
        maxAge: Number(process.env.JWT_ACCESS_EXPIRES_MIN ?? 15) * 60 * 1000,
        path: "/",
      });
      return res.ok({ userId }, "REFRESH_OK");
    }
    return res.ok({ accessToken, userId }, "REFRESH_OK");
  } catch (e) {
    next(e);
  }
});

// POST /api/v1/auth/logout
authRouter.post("/logout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = (req.cookies?.refresh_token as string) || (req.body?.refreshToken as string);
    if (token) await revokeRefresh(token);
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    return res.ok({}, "LOGOUT_OK");
  } catch (e) {
    next(e);
  }
});

// GET /api/v1/auth/me
authRouter.get("/me", async (req: Request, res: Response, next: NextFunction) => {
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

    const decoded: any = verifyToken(token);
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
});

// 호환성 위해 default export도 제공 (import authRouter from "...") 가능
export default authRouter;
