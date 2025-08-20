import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { getAccessTokenFromCookies } from '../lib/cookies';

declare global {
  namespace Express {
    interface Request {
      user?: { id: number };
    }
  }
}

export default async function authJwt(req: Request, res: Response, next: NextFunction) {
  try {
    // 1) 토큰 추출: Bearer 또는 쿠키(access_token)
    const header = req.headers.authorization || '';
    const m = header.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1] || getAccessTokenFromCookies(req.cookies);

    if (!token) {
      return res.status(401).json({ success:false, code:'NO_TOKEN', message:'missing bearer token' });
    }

    // 2) 검증 및 페이로드 파싱
    const payload: any = verifyToken(token); // { uid, jti, iat, exp, ... }
    const uid = payload?.uid;

    if (!uid) {
      return res.status(401).json({ success:false, code:'BAD_TOKEN', message:'invalid payload' });
    }

    // 3) 통과 → req.user에 식별자 저장
    (req as any).user = { id: uid };
    next();
  } catch (e: any) {
    return res.status(401).json({ success:false, code:'BAD_TOKEN', message: e?.message || 'invalid token' });
  }
}
