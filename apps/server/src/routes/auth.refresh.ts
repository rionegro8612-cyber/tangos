import { Router } from "express";
import { REFRESH_COOKIE, setAuthCookies, clearAuthCookies } from "../lib/cookies";
import { verifyRefreshToken, newJti, signAccessToken, signRefreshToken, sha256 } from "../lib/jwt";
import { findByJti, revokeAllForUser, revokeJti, saveNewRefreshToken } from "../repos/refreshTokenRepo";

export const refreshRouter = Router();

refreshRouter.post("/refresh", async (req, res) => {
  const rt = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!rt) return res.fail(401, "AUTH_NO_RT", "리프레시 토큰이 없습니다.");

  try {
    const payload = verifyRefreshToken(rt); // { uid, jti }
    const record = await findByJti(payload.jti);

    if (!record || record.revoked) {
      await revokeAllForUser(Number(payload.uid));
      clearAuthCookies(res);
      return res.fail(401, "AUTH_RT_REUSE", "세션 재인증이 필요합니다.");
    }
    if (record.token_hash !== sha256(rt)) {
      await revokeAllForUser(Number(payload.uid));
      clearAuthCookies(res);
      return res.fail(401, "AUTH_RT_TAMPERED", "세션 재인증이 필요합니다.");
    }

    const newId = newJti();
    const at = signAccessToken(Number(payload.uid), newId);
    const newRt = signRefreshToken(Number(payload.uid), newId);

    await revokeJti(payload.jti, newId);
    await saveNewRefreshToken({
      jti: newId,
      userId: Number(payload.uid),
      token: newRt,
      expiresAt: new Date(Date.now() + 30*24*60*60*1000),
      userAgent: req.get("user-agent") || undefined, ip: req.ip,
    });

    setAuthCookies(res, at, newRt);
    return res.ok({ refreshed: true }, "OK");
  } catch {
    clearAuthCookies(res);
    return res.fail(401, "AUTH_RT_INVALID", "유효하지 않은 리프레시 토큰입니다.");
  }
});
