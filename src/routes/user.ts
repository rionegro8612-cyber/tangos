import { Router } from 'express';
import { pool } from '../lib/db';
import authJwt from '../middlewares/authJwt';
import { verifyToken, signAccess } from '../lib/jwt';
import { setAuthCookies, clearAuthCookies } from '../lib/cookies';

const router = Router();

/** GET /api/v1/me (헤더 Bearer 또는 쿠키 at) */
router.get('/me', authJwt, async (req, res) => {
  const uid = (req as any).user?.uid;
  if (!uid) return res.status(401).json({ success:false, code:'NO_USER', message:'invalid token' });

  const q = await pool.query(
    'SELECT id, phone_e164_norm AS phone, name, birth, is_kyc_verified, kyc_verified_at FROM users WHERE id=$1 LIMIT 1',
    [uid]
  );
  return res.json({ success:true, code:'OK', message:'ok', data: q.rows[0] || null });
});

/** POST /api/v1/auth/token/refresh (Body.refreshToken 또는 쿠키 rt) */
router.post('/auth/token/refresh', async (req, res) => {
  const bodyToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
  const cookieToken = (req as any).cookies?.rt || '';
  const token = bodyToken || cookieToken;
  if (!token) return res.status(400).json({ success:false, code:'INVALID_ARG', message:'refreshToken required' });

  try {
    const p: any = verifyToken(token);            // { uid, tv }
    const uid = p?.uid;
    const tv  = p?.tv;
    if (!uid) return res.status(401).json({ success:false, code:'BAD_TOKEN', message:'invalid payload' });

    const r = await pool.query('SELECT token_version FROM users WHERE id=$1 LIMIT 1', [uid]);
    if (!r.rows[0]) return res.status(404).json({ success:false, code:'USER_NOT_FOUND', message:'no user' });

    const currentTv = r.rows[0].token_version;
    if (typeof tv !== 'number' || tv !== currentTv) {
      return res.status(401).json({ success:false, code:'BAD_TOKEN_VERSION', message:'revoked token' });
    }

    // 새 access 발급 (+쿠키 갱신)
    const accessToken = signAccess({ uid, tv: currentTv });
    setAuthCookies(res, accessToken);

    return res.json({ success:true, code:'OK', message:'refreshed', data:{ accessToken } });
  } catch (e: any) {
    return res.status(401).json({ success:false, code:'BAD_TOKEN', message: e?.message || 'invalid token' });
  }
});

/** POST /api/v1/auth/logout (Bearer/쿠키 인증 필요) */
router.post('/auth/logout', authJwt, async (req, res) => {
  const uid = (req as any).user?.uid;
  if (!uid) return res.status(401).json({ success:false, code:'NO_USER', message:'invalid token' });

  await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id=$1', [uid]);
  clearAuthCookies(res);
  return res.json({ success:true, code:'OK', message:'logged out' });
});

export default router;
