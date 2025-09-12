import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// 기존 getTokenFromReq 함수와 동일한 로직 (중복 방지)
function getTokenFromReq(req: Request): string | undefined {
  const hdr = req.headers.authorization || "";
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || (req.cookies?.access_token as string | undefined);
}

// 토큰 검증 및 사용자 정보 주입
function verifyAccessTokenOrThrow(token: string): { userId: string | number } {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret") as any;
    
    // UUID와 정수 모두 허용
    const userId = decoded.userId || decoded.sub || decoded.id;
    if (!userId) {
      throw new Error("Invalid token: missing user ID");
    }
    
    return { userId };
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

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
        requestId: (req as any).requestId ?? null,
      });
    }

    const { userId } = verifyAccessTokenOrThrow(token);
    
    // req.user 주입 (기존 코드와 호환: id 필드 사용)
    (req as any).user = { id: userId };
    
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

// 인증 선택적 미들웨어
export function authOptional(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getTokenFromReq(req);
    if (token) {
      const { userId } = verifyAccessTokenOrThrow(token);
      (req as any).user = { id: userId };
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