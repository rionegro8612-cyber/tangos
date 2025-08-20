import { Router } from "express";
import { newJti, signAccessToken, signRefreshToken } from "../lib/jwt";
import { setAuthCookies } from "../lib/cookies";
import { saveNewRefreshToken } from "../repos/refreshTokenRepo";
import { findByPhone, getUserProfile } from "../repos/userRepo";
import * as otp from "../otpStore";
import authJwt from "../middlewares/authJwt";
import { normalizeE164 } from "../lib/phone";

export const loginRouter = Router();

// 로그인용 OTP 발급
loginRouter.post("/send-sms", async (req, res) => {
  const { phone } = req.body ?? {};
  if (!phone) return res.fail(400, "VAL_400", "phone 필수");

  const e164 = normalizeE164(phone);
  let user = await findByPhone(e164);
  
  // 테스트용: 사용자가 없으면 자동 생성 (실제 운영에서는 제거)
  if (!user) {
    console.log(`[DEV] 사용자 자동 생성: ${e164}`);
    // 간단한 사용자 생성 (실제로는 회원가입 플로우를 거쳐야 함)
    const { findOrCreateUserByPhoneE164 } = await import("../repos/userRepo");
    const userId = await findOrCreateUserByPhoneE164(e164);
    user = { id: userId };
  }

  const code = otp.generateCode();
  otp.putCode(e164, code, "login");
  
  // send via SMS vendor (mock in dev by default)
  if (process.env.NODE_ENV !== "test") {
    // SMS 전송 로직 (현재는 콘솔 출력)
    console.log(`[DEV] SMS to ${e164}: [Tango] 인증번호: ${code}`);
  }
  
  const devCode = process.env.NODE_ENV !== "production" ? code : undefined;
  return res.ok({ issued: true, ttlSec: 300, ...(devCode ? { devCode } : {}) }, "OK");
});

// 로그인 OTP 검증 + 세션 발급
loginRouter.post("/verify-login", async (req, res) => {
  const { phone, code } = req.body ?? {};
  if (!phone || !code) return res.fail(400, "VAL_400", "phone, code 필수");

  const e164 = normalizeE164(phone);
  const ok = otp.verifyCode(e164, code, "login");
  if (!ok) return res.fail(401, "INVALID_CODE", "인증번호가 올바르지 않거나 만료되었습니다.");

  const user = await findByPhone(e164);
  if (!user) return res.fail(404, "USER_NOT_FOUND", "가입된 사용자가 없습니다.");

  const jti = newJti();
  const at  = signAccessToken(user.id, jti);
  const rt  = signRefreshToken(user.id, jti);
  await saveNewRefreshToken({
    jti, userId: user.id, token: rt,
    expiresAt: new Date(Date.now() + 30*24*60*60*1000),
    userAgent: req.headers["user-agent"]?.toString() ?? undefined,
    ip: req.ip ?? undefined,
  });
  setAuthCookies(res, at, rt);
  return res.ok({ userId: user.id, autoLogin: true }, "LOGIN_OK");
});

// 프론트 요청 경로에 맞춰 /verify-code 추가 (verify-login과 동일)
loginRouter.post("/verify-code", async (req, res) => {
  const { phone, code } = req.body ?? {};
  if (!phone || !code) return res.fail(400, "VAL_400", "phone, code 필수");

  const e164 = normalizeE164(phone);
  const ok = otp.verifyCode(e164, code, "login");
  if (!ok) return res.fail(401, "INVALID_CODE", "인증번호가 올바르지 않거나 만료되었습니다.");

  const user = await findByPhone(e164);
  if (!user) return res.fail(404, "USER_NOT_FOUND", "가입된 사용자가 없습니다.");

  const jti = newJti();
  const at  = signAccessToken(user.id, jti);
  const rt  = signRefreshToken(user.id, jti);
  await saveNewRefreshToken({
    jti, userId: user.id, token: rt,
    expiresAt: new Date(Date.now() + 30*24*60*60*1000),
    userAgent: req.headers["user-agent"]?.toString() ?? undefined,
    ip: req.ip ?? undefined,
  });
  setAuthCookies(res, at, rt);
  return res.ok({ userId: user.id, autoLogin: true }, "LOGIN_OK");
});

// 세션 확인
loginRouter.get("/me", authJwt, async (req, res) => {
  if (!req.user?.uid) return res.fail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  
  // uid로 사용자 조회 (uid는 number 타입)
  const user = await getUserProfile(req.user.uid);
  if (!user) return res.fail(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
  
  return res.ok({ 
    id: user.id, 
    phone: user.phone, 
    nickname: user.nickname 
  }, "OK");
});
