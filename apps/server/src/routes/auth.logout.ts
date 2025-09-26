import { Router } from "express";
import { REFRESH_COOKIE, clearAuthCookies } from "../lib/cookies";
import { verifyRefreshToken, sha256 } from "../lib/jwt";
import { revokeToken } from "../repos/refreshTokenRepo";

export const logoutRouter = Router();

logoutRouter.post("/logout", async (req, res) => {
  const rt = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (rt) {
    try {
      const payload = verifyRefreshToken(rt);
      const tokenHash = sha256(rt);
      await revokeToken(tokenHash);
    } catch {
      /* ignore */
    }
  }
  clearAuthCookies(res);
  return res.ok({ loggedOut: true }, "OK");
});
