import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

/** Authorization: Bearer <token> 또는 쿠키 access_token 에서 토큰 추출 */
function getTokenFromReq(req: Request): string | undefined {
  const hdr = req.headers.authorization || "";
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || (req.cookies?.access_token as string | undefined);
}

/** 로그인 필수 미들웨어 */
export function authRequired(req: Request, res: Response, next: NextFunction) {
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
    const uid = Number(decoded?.uid);
    if (!uid) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "invalid token",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    (req as any).user = { uid };
    return next();
  } catch (e) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "invalid token",
      data: null,
      requestId: (req as any).requestId ?? null,
    });
  }
}

/** 타입 보강: req.user 사용 가능하게 */
declare global {
  namespace Express {
    // 필요한 필드만 정의
    interface Request {
      user?: { uid: number };
    }
  }
}
