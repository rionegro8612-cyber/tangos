// apps/server/src/middlewares/auth.ts
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { COOKIE_NAME } from "../lib/cookies";

const ACCESS_COOKIE = "access_token";

function getTokenFromReq(req: Request): string | undefined {
  // 1) Bearer 토큰 우선
  const hdr = req.headers.authorization ?? "";
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1];

  // 2) 현재 서버가 발급하는 쿠키명 (access_token)
  const access = req.cookies?.[ACCESS_COOKIE] as string | undefined;
  if (access) return access;

  // 3) 프로젝트 상수(폴백) - 향후 쿠키명 통일 시 유용
  const fallback = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (fallback) return fallback;

  return undefined;
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getTokenFromReq(req);
    if (!token) {
      return res.fail("AUTH_401", "인증이 필요합니다.", 401);
    }
    const payload = verifyToken(token);
    (req as any).user = { uid: Number((payload as any).uid) };
    return next();
  } catch {
    return res.fail("AUTH_401", "유효하지 않은 토큰입니다.", 401);
  }
}

/** 타입 보강: req.user 사용 가능하게 */
declare global {
  namespace Express {
    interface Request {
      user?: { uid: number };
    }
  }
}
