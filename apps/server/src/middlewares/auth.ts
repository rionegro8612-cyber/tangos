// apps/server/src/middlewares/auth.ts
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { ACCESS_COOKIE } from "../lib/cookies";
import { validate as uuidValidate } from "uuid";

function getTokenFromReq(req: Request): string | undefined {
  const hdr = req.headers.authorization ?? "";
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1];
  return req.cookies?.[ACCESS_COOKIE] as string | undefined;
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.fail(401, "AUTH_401", "인증이 필요합니다.");
    
    const payload = verifyAccessToken(token);
    const userId = String(payload.uid);
    
    // UUID 형식 검증 (uuidValidate 사용)
    if (!userId || !uuidValidate(userId)) {
      return res.fail(401, "AUTH_401", "유효하지 않은 사용자 ID 형식입니다.");
    }
    
    req.user = { id: userId };
    next();
  } catch {
    return res.fail(401, "AUTH_401", "유효하지 않은 토큰입니다.");
  }
}

declare global {
  namespace Express { interface Request { user?: { id: string }; } }
}
