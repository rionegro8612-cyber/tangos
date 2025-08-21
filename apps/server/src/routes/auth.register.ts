
import { Router } from "express";
import { issueOtp, verifyOtp } from "../services/register.otp";
import { upsertActiveSession, markPhoneVerified, findActiveByPhone, completeAndDelete } from "../repos/signupSessionRepo";
import { findByPhone, createUserWithKyc } from "../services/register.user";
import { newJti, signAccessToken, signRefreshToken } from "../lib/jwt";
import { saveNewRefreshToken } from "../repos/refreshTokenRepo";
import { setAuthCookies } from "../lib/cookies";
import { verifyKyc } from "../external/kyc";
import { calcAgeFromBirthYYYYMMDD } from "../lib/age";

export const registerRouter = Router();

/** POST /api/v1/auth/register/start
 *  Body: { phone, carrier }
 */
registerRouter.post("/register/start", async (req, res) => {
  const { phone, carrier } = req.body ?? {};
  if (!phone || !carrier) return res.fail(400, "VAL_400", "phone, carrier 필수");

  if (await findByPhone(phone)) {
    return res.fail(409, "USER_EXISTS", "이미 가입된 전화번호입니다.");
  }

  const { ttlSec, devCode } = await issueOtp(phone, "register");
  await upsertActiveSession(phone, carrier, ttlSec);
  return res.ok({ issued: true, ttlSec, devCode: process.env.NODE_ENV!=="production" ? devCode : undefined });
});

/** POST /api/v1/auth/register/verify-code
 *  Body: { phone, code }
 */
registerRouter.post("/register/verify-code", async (req, res) => {
  const { phone, code } = req.body ?? {};
  if (!phone || !code) return res.fail(400, "VAL_400", "phone, code 필수");

  const ok = await verifyOtp(phone, code, "register");
  if (!ok) return res.fail(401, "INVALID_CODE", "코드가 올바르지 않거나 만료되었습니다.");

  await markPhoneVerified(phone);
  return res.ok({ phoneVerified: true });
});

/** POST /api/v1/auth/register/submit
 *  Body: { phone, name, birth(YYYY-MM-DD), gender, termsAccepted:[{key,version}] }
 */
registerRouter.post("/register/submit", async (req, res) => {
  const { phone, name, birth, gender, termsAccepted } = req.body ?? {};
  if (!phone || !name || !birth || !termsAccepted?.length) {
    return res.fail(400, "VAL_400", "필수 항목 누락");
  }
  if (await findByPhone(phone)) {
    return res.fail(409, "USER_EXISTS", "이미 가입된 전화번호입니다.");
  }

  const session = await findActiveByPhone(phone);
  if (!session || !session.phone_verified) {
    return res.fail(409, "REGISTER_FLOW_ERROR", "전화번호 검증이 선행되어야 합니다.");
  }

  // birth 형식을 YYYY-MM-DD로 파싱
  const birthDate = new Date(birth);
  if (isNaN(birthDate.getTime())) {
    return res.fail(400, "VAL_400", "birth 형식은 YYYY-MM-DD");
  }
  
  const age = calcAgeFromBirthYYYYMMDD(birth.replace(/-/g, ''));
  if (age < 0) return res.fail(400, "VAL_400", "birth 형식은 YYYY-MM-DD");
  if (age < 50) return res.fail(403, "KYC_AGE_RESTRICTED", "가입은 만 50세 이상부터 가능합니다.");

  // termsAccepted에서 필수 약관 확인
  const hasTos = termsAccepted.some((t: { key: string; version: string }) => t.key === 'tos');
  const hasPrivacy = termsAccepted.some((t: { key: string; version: string }) => t.key === 'privacy');
  if (!hasTos || !hasPrivacy) {
    return res.fail(400, "VAL_400", "tos, privacy 약관 동의 필수");
  }

  const kyc = await verifyKyc({ name, birth, carrier: session.carrier, phone });
  if (!kyc.ok) {
    const code = kyc.reason === "TEMPORARY_FAILURE" ? "KYC_TEMPORARY_FAILURE" : "KYC_MISMATCH";
    const status = kyc.reason === "TEMPORARY_FAILURE" ? 502 : 401;
    return res.fail(status, code, code === "KYC_MISMATCH" ? "본인정보 불일치" : "외부 연동 장애");
  }

  const userId: string = await createUserWithKyc({
    phone, name, birth, gender: gender ?? null, carrier: session.carrier,
    consent: { 
      tos: hasTos, 
      privacy: hasPrivacy, 
      marketing: termsAccepted.some((t: { key: string; version: string }) => t.key === 'marketing') 
    },
    kycProvider: kyc.provider
  });

  const jti = newJti();
  const at = signAccessToken(userId, jti);
  const rt = signRefreshToken(userId, jti);
  await saveNewRefreshToken({ jti, userId, token: rt, expiresAt: new Date(Date.now()+30*24*60*60*1000) });
  setAuthCookies(res, at, rt);

  await completeAndDelete(phone);
  return res.ok({ userId, autoLogin: true }, "REGISTER_OK");
});
