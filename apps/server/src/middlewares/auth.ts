import { Request, Response, NextFunction } from "express";
import { verifyAccessTokenOrThrow } from "../lib/jwt";
import { getTokenFromReq } from "../lib/auth.shared";

// lib/jwt.ts의 verifyAccessTokenOrThrow 함수를 사용 (중복 제거)

// 인증 필수 미들웨어
export function authRequired(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getTokenFromReq(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication required",
        data: null,
        requestId: (req as any).requestId ?? "",
      });
    }

    const { uid } = verifyAccessTokenOrThrow(token); // lib/jwt.ts의 함수 사용
    
    // req.user 주입 (기존 코드와 호환: id 필드 사용)
    (req as any).user = { id: uid };
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED", 
      message: error instanceof Error ? error.message : "Authentication failed",
      data: null,
      requestId: (req as any).requestId ?? "",
    });
  }
}

// 인증 선택적 미들웨어
export function authOptional(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getTokenFromReq(req);
    if (token) {
      const { uid } = verifyAccessTokenOrThrow(token); // lib/jwt.ts의 함수 사용
      (req as any).user = { id: uid };
    }
    // 토큰이 없어도 통과 (인증 선택적)
    next();
  } catch (error) {
    // 토큰이 있지만 유효하지 않은 경우에도 통과 (선택적이므로)
    next();
  }
}

// Express Request 타입 확장 (기존 코드와 호환)
declare global {
  namespace Express {
    interface Request {
      user?: { id: string | number };
    }
  }
}
