import { Router } from "express";
import { REFRESH_COOKIE, clearAuthCookies } from "../lib/cookies";

export const refreshRouter = Router();

refreshRouter.post("/refresh", async (req, res) => {
  const rt = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!rt) return res.fail("AUTH_NO_RT", "리프레시 토큰이 없습니다.", 401);

  // 임시로 테이블이 없으므로 간단히 로그인 재요청 처리
  console.log('[REFRESH] 리프레시 토큰 요청 - 테이블 없음으로 인한 재로그인 요청');
  clearAuthCookies(res);
  return res.fail("AUTH_RT_REUSE", "세션 재인증이 필요합니다.", 401);

  // TODO: refresh_tokens 테이블 생성 후 다음 코드 활성화
  /*
  import { verifyRefreshToken, newJti, signAccessToken, signRefreshToken, sha256 } from "../lib/jwt";
  import { findByJti, revokeAllForUser, revokeJti, saveNewRefreshToken } from "../repos/refreshTokenRepo";
  import { setAuthCookies } from "../lib/cookies";

  try {
    const payload = verifyRefreshToken(rt); // { uid, jti }
    const record = await findByJti(payload.jti);

    if (!record || record.revoked) {
      await revokeAllForUser(String(payload.uid));
      clearAuthCookies(res);
      return res.fail("AUTH_RT_REUSE", "세션 재인증이 필요합니다.", 401);
    }
    if (record.token_hash !== sha256(rt)) {
      await revokeAllForUser(String(payload.uid));
      clearAuthCookies(res);
      return res.fail("AUTH_RT_TAMPERED", "세션 재인증이 필요합니다.", 401);
    }

    const newId = newJti();
    const at = signAccessToken(String(payload.uid), newId);
    const newRt = signRefreshToken(String(payload.uid), newId);

    await revokeJti(payload.jti, newId);
    await saveNewRefreshToken({
      jti: newId,
      userId: String(payload.uid),
      token: newRt,
      expiresAt: new Date(Date.now() + 30*24*60*60*1000),
      userAgent: req.get("user-agent") || undefined, 
      ip: req.ip,
    });

    setAuthCookies(res, at, newRt);
    return res.ok({ refreshed: true }, "OK");
  } catch {
    clearAuthCookies(res);
    return res.fail("AUTH_RT_INVALID", "유효하지 않은 리프레시 토큰입니다.", 401);
  }
  */
});