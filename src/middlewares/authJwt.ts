import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { pool } from '../lib/db';

export default async function authJwt(req: Request, res: Response, next: NextFunction) {
  try {
    // 1) 토큰 추출: Bearer 또는 쿠키(at)
    const header = req.headers.authorization || '';
    const m = header.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1] || (req as any).cookies?.at;

    if (!token) {
      return res.status(401).json({ success:false, code:'NO_TOKEN', message:'missing bearer token' });
    }

    // 2) 검증 및 페이로드 파싱
    const payload: any = verifyToken(token); // { uid, tv, iat, exp, ... }
    const uid = payload?.uid;
    const tv  = payload?.tv;

    if (!uid) {
      return res.status(401).json({ success:false, code:'BAD_TOKEN', message:'invalid payload' });
    }

    // 3) DB의 token_version과 비교 (로그아웃/강제 로그아웃 반영)
    const r = await pool.query('SELECT token_version FROM users WHERE id=$1 LIMIT 1', [uid]);
    if (r.rowCount === 0) {
      return res.status(404).json({ success:false, code:'USER_NOT_FOUND', message:'no user' });
    }

    const currentTv: number = r.rows[0].token_version;
    if (typeof tv !== 'number' || tv !== currentTv) {
      return res.status(401).json({ success:false, code:'BAD_TOKEN_VERSION', message:'revoked token' });
    }

    // 4) 통과 → req.user에 식별자 저장
    (req as any).user = { uid, tv: currentTv };
    next();
  } catch (e: any) {
    return res.status(401).json({ success:false, code:'BAD_TOKEN', message: e?.message || 'invalid token' });
  }
}
