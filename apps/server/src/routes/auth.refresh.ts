import { Router } from "express";
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "../lib/cookies";
import { verifyRefreshToken, newJti, signAccessToken, signRefreshToken, sha256 } from "../lib/jwt";
import { findByTokenHash, revokeAllForUser, revokeToken, saveNewRefreshToken } from "../repos/refreshTokenRepo";

export const refreshRouter = Router();

refreshRouter.post("/refresh", async (req, res) => {
  const rt = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!rt) return res.fail("AUTH_NO_RT", "리프레시 토큰이 없습니다.", 401);

  try {
    const payload = verifyRefreshToken(rt); // { uid, jti }
    const tokenHash = sha256(rt);
    const record = await findByTokenHash(tokenHash);

    if (!record) {
      await revokeAllForUser(String(payload.uid));
      clearAuthCookies(res);
      return res.fail("AUTH_RT_REUSE", "세션 재인증이 필요합니다.", 401);
    }

    // 토큰 회전: 새 토큰 발급
    const newId = newJti();
    const at = signAccessToken(String(payload.uid), newId);
    const newRt = signRefreshToken(String(payload.uid), newId);

    // 기존 토큰 폐기
    await revokeToken(tokenHash);
    
    // 새 토큰 저장
    await saveNewRefreshToken({
      jti: newId,
      userId: String(payload.uid),
      token: newRt,
      expiresAt: new Date(Date.now() + 30*24*60*60*1000),
      userAgent: req.get("user-agent") || undefined, 
      ip: req.ip,
    });

    setAuthCookies(res, at, newRt);
    return res.ok({ refreshed: true }, "토큰이 갱신되었습니다.");
  } catch (error) {
    console.error("[REFRESH] 토큰 검증 실패:", error);
    clearAuthCookies(res);
    return res.fail("AUTH_RT_INVALID", "유효하지 않은 리프레시 토큰입니다.", 401);
  }
});
