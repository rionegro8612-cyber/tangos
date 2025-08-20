import { Router } from "express";
import { REFRESH_COOKIE, clearAuthCookies } from "../lib/cookies";
import { verifyRefreshToken } from "../lib/jwt";
import { revokeJti } from "../repos/refreshTokenRepo";

export const logoutRouter = Router();

logoutRouter.post("/logout", async (req, res) => {
  const rt = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (rt) {
    try { const payload = verifyRefreshToken(rt); await revokeJti(payload.jti); } catch { /* ignore */ }
  }
  clearAuthCookies(res);
  return res.ok({ loggedOut: true }, "OK");
});
