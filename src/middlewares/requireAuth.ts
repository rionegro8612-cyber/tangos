import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

export interface AuthedRequest extends Request {
  userId?: number;
  user?: { id: string | number };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const hdr = req.headers.authorization ?? "";
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1] || (req.cookies?.access_token as string | undefined);
    if (!token) return res.fail("UNAUTHORIZED", "missing token", 401);

    const decoded: any = verifyToken(token);
    const uid = Number(decoded?.uid);
    if (!uid) return res.fail("UNAUTHORIZED", "invalid token", 401);

    req.userId = uid;
    next();
  } catch (e: any) {
    return res.fail("UNAUTHORIZED", e?.message || "unauthorized", 401);
  }
}

// 새로운 인증 미들웨어들 (기존 구조와 호환)
export function authRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const hdr = req.headers.authorization ?? "";
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1] || (req.cookies?.access_token as string | undefined);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication required",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    const decoded: any = verifyToken(token);
    const userId = decoded?.uid || decoded?.sub || decoded?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Invalid token: missing user ID",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 기존 구조와 호환: req.user.id 사용
    req.user = { id: userId };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED", 
      message: error instanceof Error ? error.message : "Authentication failed",
      data: null,
      requestId: (req as any).requestId ?? null,
    });
  }
}

export function authOptional(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const hdr = req.headers.authorization ?? "";
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1] || (req.cookies?.access_token as string | undefined);
    
    if (token) {
      const decoded: any = verifyToken(token);
      const userId = decoded?.uid || decoded?.sub || decoded?.userId;
      
      if (userId) {
        req.user = { id: userId };
      }
    }
    // 토큰이 없어도 통과 (인증 선택적)
    next();
  } catch (error) {
    // 토큰이 있지만 유효하지 않은 경우에도 통과 (선택적이므로)
    next();
  }
}
