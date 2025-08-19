import { Router } from "express";
import { newJti, signAccessToken, signRefreshToken } from "../lib/jwt";
import { setAuthCookies } from "../lib/cookies";
import { saveNewRefreshToken } from "../repos/refreshTokenRepo";
import { findByPhone } from "../repos/userRepo";
// import userRepo, otpStore 등...

export const loginRouter = Router();

loginRouter.post("/auth/verify-code", async (req, res) => {
  const { phone, code, purpose } = req.body ?? {};
  // purpose === "login" 확인 + OTP 검증 로직…
  // 기가입자 조회…
  const user = await findByPhone(String(phone));
  if (!user) return res.fail("USER_NOT_FOUND", "가입 이력이 없습니다. 회원가입을 진행해주세요.", 404);

  const jti = newJti();
  const at = signAccessToken(user.id, jti);
  const rt = signRefreshToken(user.id, jti);

  await saveNewRefreshToken({
    jti, userId: user.id, token: rt,
    expiresAt: new Date(Date.now() + 30*24*60*60*1000),
    userAgent: req.get("user-agent") || undefined,
    ip: req.ip,
  });

  setAuthCookies(res, at, rt);
  return res.ok({ userId: String(user.id) }, "LOGIN_OK");
});
