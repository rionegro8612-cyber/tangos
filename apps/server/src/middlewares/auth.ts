// apps/server/src/middlewares/auth.ts
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { ACCESS_COOKIE } from "../lib/cookies";

function getTokenFromReq(req: Request): string | undefined {
  const hdr = req.headers.authorization ?? "";
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1];
  return req.cookies?.[ACCESS_COOKIE] as string | undefined;
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.fail("AUTH_401", "인증이 필요합니다.", 401);
    const payload = verifyAccessToken(token);
    req.user = { uid: Number(payload.uid) };
    next();
  } catch {
    return res.fail("AUTH_401", "유효하지 않은 토큰입니다.", 401);
  }
}

declare global {
  namespace Express { interface Request { user?: { uid: number }; } }
}
