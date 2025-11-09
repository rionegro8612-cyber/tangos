import { Router } from "express";
import { newJti, signAccessToken, signRefreshToken } from "../lib/jwt";
import { setAuthCookies } from "../lib/cookies";
import { saveNewRefreshToken } from "../repos/refreshTokenRepo";
import { findByPhone, getUserProfile } from "../repos/userRepo";
import { getOtp, delOtp, setOtp } from "../services/otp.service";
import { authRequired } from "../middlewares/auth";
import { normalizeE164 } from "../lib/phone";
import { recordOtpSend, recordOtpVerify, recordUserLogin } from "../lib/metrics";

export const loginRouter = Router();

// 로그인용 OTP 발급
loginRouter.post("/send-sms", async (req, res) => {
  const { phone } = req.body ?? {};
  if (!phone) return res.fail("VAL_400", "phone 필수", 400);

  const e164 = normalizeE164(phone);
  let user = await findByPhone(e164);

  // 테스트용: 사용자가 없으면 자동 생성 (실제 운영에서는 제거)
  if (!user) {
    console.log(`[DEV] 사용자 자동 생성: ${e164}`);
    // 간단한 사용자 생성 (실제로는 회원가입 플로우를 거쳐야 함)
    const { findOrCreateUserByPhoneE164 } = await import("../repos/userRepo");
    const userId: string = await findOrCreateUserByPhoneE164(e164);
    user = { id: userId };
  }

  const code = "" + Math.floor(100000 + Math.random() * 900000);
  await setOtp(e164, code, "login", 300); // 5분 TTL

  // send via SMS vendor (mock in dev by default)
  if (process.env.NODE_ENV !== "test") {
    // SMS 전송 로직 (현재는 콘솔 출력)
    console.log(`[DEV] SMS to ${e164}: [Tango] 인증번호: ${code}`);
  }

  // 🆕 메트릭: OTP 전송 성공
  recordOtpSend("success", "MOCK", "unknown");

  const devCode = process.env.NODE_ENV !== "production" ? code : undefined;
  return res.ok({ issued: true, ttlSec: 300, ...(devCode ? { devCode } : {}) }, "OK");
});

// 로그인 OTP 검증 + 세션 발급
loginRouter.post("/verify-login", async (req, res) => {
  const { phone, otp } = req.body ?? {};
  if (!phone || !otp) return res.fail("VAL_400", "phone, otp 필수", 400);

  const e164 = normalizeE164(phone);
  const { code: storedCode } = await getOtp(e164, "login");
  if (!storedCode || storedCode !== otp) {
    // 🆕 메트릭: OTP 검증 실패
    recordOtpVerify("fail", "INVALID_CODE");
    return res.fail("INVALID_CODE", "인증번호가 올바르지 않거나 만료되었습니다.", 401);
  }

  // 🆕 메트릭: OTP 검증 성공
  recordOtpVerify("success", "VALID_CODE");

  // OTP 코드 삭제
  await delOtp(e164, "login");

  const user = await findByPhone(e164);
  if (!user) return res.fail("USER_NOT_FOUND", "가입된 사용자가 없습니다.", 404);

  const jti = newJti();
  const at = signAccessToken(String(user.id), jti);
  const rt = signRefreshToken(String(user.id), jti);
  
  console.log("[LOGIN_DEBUG] 토큰 생성 완료:", { jti, userId: String(user.id) });
  
  // 리프레시 토큰 저장
  console.log("[LOGIN_DEBUG] 리프레시 토큰 저장 시작");
  await saveNewRefreshToken({
    jti, 
    userId: String(user.id), 
    token: rt,
    expiresAt: new Date(Date.now() + 30*24*60*60*1000),
    userAgent: req.headers["user-agent"]?.toString() ?? undefined,
    ip: req.ip ?? undefined,
  });
  console.log("[LOGIN_DEBUG] 리프레시 토큰 저장 완료");
  
  setAuthCookies(res, at, rt);

  // 🆕 메트릭: 사용자 로그인 성공
  recordUserLogin("success", "LOGIN_OK");

  return res.ok({ userId: String(user.id), autoLogin: true }, "LOGIN_OK");
});

// 프론트 요청 경로에 맞춰 /verify-code 추가 (verify-login과 동일)
loginRouter.post("/verify-code", async (req, res) => {
  const { phone, code } = req.body ?? {};
  if (!phone || !code) return res.fail("VAL_400", "phone, code 필수", 400);

  const e164 = normalizeE164(phone);
  const { code: storedCode } = await getOtp(e164, "login");
  if (!storedCode || storedCode !== code) {
    // 🆕 메트릭: OTP 검증 실패
    recordOtpVerify("fail", "INVALID_CODE");
    return res.fail("INVALID_CODE", "인증번호가 올바르지 않거나 만료되었습니다.", 401);
  }

  // 🆕 메트릭: OTP 검증 성공
  recordOtpVerify("success", "VALID_CODE");

  // OTP 코드 삭제
  await delOtp(e164, "login");

  const user = await findByPhone(e164);
  if (!user) return res.fail("USER_NOT_FOUND", "가입된 사용자가 없습니다.", 404);

  const jti = newJti();
  const at = signAccessToken(String(user.id), jti);
  const rt = signRefreshToken(String(user.id), jti);
  
  console.log("[LOGIN_DEBUG] 토큰 생성 완료:", { jti, userId: String(user.id) });
  
  // 리프레시 토큰 저장
  console.log("[LOGIN_DEBUG] 리프레시 토큰 저장 시작");
  await saveNewRefreshToken({
    jti, 
    userId: String(user.id), 
    token: rt,
    expiresAt: new Date(Date.now() + 30*24*60*60*1000),
    userAgent: req.headers["user-agent"]?.toString() ?? undefined,
    ip: req.ip ?? undefined,
  });
  console.log("[LOGIN_DEBUG] 리프레시 토큰 저장 완료");
  
  setAuthCookies(res, at, rt);

  // 🆕 메트릭: 사용자 로그인 성공
  recordUserLogin("success", "LOGIN_OK");

  return res.ok({ userId: String(user.id), autoLogin: true }, "LOGIN_OK");
});

// 세션 확인
loginRouter.get("/me", authRequired, async (req, res) => {
  if (!req.user?.id) return res.fail("UNAUTHORIZED", "로그인이 필요합니다.", 401);

  // id로 사용자 조회 (id는 string 타입으로 변환)
  const user = await getUserProfile(String(req.user.id));
  if (!user) return res.fail("USER_NOT_FOUND", "사용자를 찾을 수 없습니다.", 404);

  return res.ok(
    {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
    },
    "OK",
  );
});
