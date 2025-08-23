
import { Router } from "express";
import { issueOtp, verifyOtp } from "../services/register.otp";
import { upsertActiveSession, markPhoneVerified, findActiveByPhone, completeAndDelete } from "../repos/signupSessionRepo";
import { findByPhone, createUserWithKyc } from "../services/register.user";
import { newJti, signAccessToken, signRefreshToken } from "../lib/jwt";
// import { saveNewRefreshToken } from "../repos/refreshTokenRepo"; // 임시 비활성화
import { setAuthCookies } from "../lib/cookies";
import { verifyKyc } from "../external/kyc";
import { calcAgeFromBirthYYYYMMDD } from "../lib/age";
import { validate } from "../middlewares/validate";
import { StandardError, createError } from "../lib/errorCodes";
import { normalizePhoneNumber } from "../lib/otpService";
import { pool } from "../lib/db";
import { redis } from "../lib/redis";

export const registerRouter = Router();

// 새로운 표준화된 회원가입 데이터 스키마 (Zod 대신 간단한 검증)
const validateStandardRegister = (data: any) => {
  const errors: string[] = [];
  
  if (!data.phone || !/^\+82[0-9]{9,10}$/.test(data.phone)) {
    errors.push('전화번호는 +82로 시작하는 12-13자리여야 합니다');
  }
  
  if (!data.name || data.name.length < 2 || data.name.length > 20) {
    errors.push('이름은 2-20자 사이여야 합니다');
  }
  
  if (!data.birthDate || !/^[0-9]{8}$/.test(data.birthDate)) {
    errors.push('생년월일은 YYYYMMDD 형식이어야 합니다');
  }
  
  if (!data.nickname || data.nickname.length < 2 || data.nickname.length > 20) {
    errors.push('닉네임은 2-20자 사이여야 합니다');
  }
  
  if (data.termsAccepted !== true) {
    errors.push('약관 동의가 필요합니다');
  }
  
  return errors;
};

/**
 * POST /api/v1/auth/register (새로운 표준화된 엔드포인트)
 * 회원가입 최종 제출 (약관 동의 시점)
 * 프론트엔드는 멀티스텝 수집, 서버는 단일 제출
 */
registerRouter.post("/register", async (req, res, next) => {
  try {
    const {
      phone,
      name,
      birthDate,
      nickname,
      termsAccepted,
      marketingConsent = false,
      profileImage,
      kycData
    } = req.body;

    // 데이터 검증
    const validationErrors = validateStandardRegister(req.body);
    if (validationErrors.length > 0) {
      throw createError.validationError(validationErrors.join(', '));
    }

    // 1. 약관 동의 확인
    if (!termsAccepted) {
      throw createError.unauthorized('약관 동의가 필요합니다');
    }

    // 2. 전화번호 정규화
    const normalizedPhone = normalizePhoneNumber(phone);

    // 3. OTP 인증 완료 확인 (Redis에서 가입 티켓 확인)
    const ticketKey = `reg:ticket:${normalizedPhone}`;
    const ticketData = await redis.get(ticketKey);
    
    if (!ticketData) {
      throw createError.unauthorized('전화번호 인증이 완료되지 않았습니다');
    }

    const ticket = JSON.parse(ticketData);
    if (!ticket.verifiedAt) {
      throw createError.unauthorized('전화번호 인증이 완료되지 않았습니다');
    }

    // 4. 중복 가입 확인
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE phone_e164_norm = $1',
      [normalizedPhone]
    );

    if (existingUser.rows.length > 0) {
      throw createError.duplicateUser('이미 가입된 전화번호입니다');
    }

    // 5. KYC 검증 (PASS 1순위, NICE 전환)
    let kycResult;
    try {
      kycResult = await verifyKyc({
        name,
        birth: birthDate,
        carrier: "SKT", // 기본값, 실제로는 사용자 선택
        phone: normalizedPhone
      });
    } catch (kycError) {
      if (kycError instanceof StandardError) {
        throw kycError; // KYC 에러는 그대로 전파
      }
      throw createError.kycVerificationFailed('신원인증에 실패했습니다');
    }

    // 6. 사용자 생성
    const userResult = await pool.query(
      `INSERT INTO users 
       (phone_e164_norm, nickname, created_at) 
       VALUES ($1, $2, NOW()) 
       RETURNING id, phone_e164_norm, nickname, created_at`,
      [normalizedPhone, nickname]
    );

    const newUser = userResult.rows[0];

    // 7. 추가 사용자 정보 저장 (별도 테이블)
    await pool.query(
      `INSERT INTO user_profiles 
       (user_id, name, birth_date, marketing_consent, profile_image, kyc_provider, kyc_ci, kyc_di) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        newUser.id,
        name,
        birthDate,
        marketingConsent,
        profileImage,
        kycResult.provider,
        kycData?.ci || '',
        kycData?.di || ''
      ]
    );

    // 8. 가입 티켓 삭제
    await redis.del(ticketKey);

    // 9. 성공 응답
    res.ok({
      user: {
        id: newUser.id,
        phone: newUser.phone_e164_norm,
        nickname: newUser.nickname,
        name,
        birthDate,
        marketingConsent,
        profileImage,
        kycProvider: kycResult.provider,
        createdAt: newUser.created_at
      },
      message: '회원가입이 완료되었습니다'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/register/check-phone
 * 전화번호 가입 가능 여부 확인
 */
registerRouter.get("/register/check-phone", async (req, res, next) => {
  try {
    const { phone } = req.query;
    
    if (!phone || typeof phone !== 'string') {
      throw createError.missingParameter('전화번호를 입력해주세요');
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    
    // 중복 가입 확인
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE phone_e164_norm = $1',
      [normalizedPhone]
    );

    const isAvailable = existingUser.rows.length === 0;
    
    res.ok({
      phone: normalizedPhone,
      isAvailable,
      message: isAvailable ? '사용 가능한 전화번호입니다' : '이미 가입된 전화번호입니다'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/register/check-nickname
 * 닉네임 중복 확인
 */
registerRouter.get("/register/check-nickname", async (req, res, next) => {
  try {
    const { nickname } = req.query;
    
    if (!nickname || typeof nickname !== 'string') {
      throw createError.missingParameter('닉네임을 입력해주세요');
    }

    if (nickname.length < 2 || nickname.length > 20) {
      throw createError.invalidFormat('닉네임은 2~20자 사이여야 합니다');
    }

    // 닉네임 중복 확인
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE nickname = $1',
      [nickname]
    );

    const isAvailable = existingUser.rows.length === 0;
    
    res.ok({
      nickname,
      isAvailable,
      message: isAvailable ? '사용 가능한 닉네임입니다' : '이미 사용 중인 닉네임입니다'
    });

  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/auth/register/start
 *  Body: { phone, carrier }
 */
registerRouter.post("/register/start", async (req, res) => {
  const { phone, carrier } = req.body ?? {};
  if (!phone || !carrier) return res.fail("VAL_400", "phone, carrier 필수", 400);

  if (await findByPhone(phone)) {
    return res.fail("USER_EXISTS", "이미 가입된 전화번호입니다.", 409);
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
  if (!phone || !code) return res.fail("VAL_400", "phone, code 필수", 400);

  const ok = await verifyOtp(phone, code, "register");
  if (!ok) return res.fail("INVALID_CODE", "코드가 올바르지 않거나 만료되었습니다.", 401);

  await markPhoneVerified(phone);
  return res.ok({ phoneVerified: true });
});

/** POST /api/v1/auth/register/submit
 *  Body: { phone, name, birth(YYYY-MM-DD), gender, termsAccepted:[{key,version}] }
 */
registerRouter.post("/register/submit", async (req, res) => {
  const { phone, name, birth, gender, termsAccepted } = req.body ?? {};
  if (!phone || !name || !birth || !termsAccepted?.length) {
    return res.fail("VAL_400", "필수 항목 누락", 400);
  }
  if (await findByPhone(phone)) {
    return res.fail("USER_EXISTS", "이미 가입된 전화번호입니다.", 409);
  }

  const session = await findActiveByPhone(phone);
  if (!session || !session.phone_verified) {
    return res.fail("REGISTER_FLOW_ERROR", "전화번호 검증이 선행되어야 합니다.", 409);
  }

  // birth 형식을 YYYY-MM-DD로 파싱
  const birthDate = new Date(birth);
  if (isNaN(birthDate.getTime())) {
    return res.fail("VAL_400", "birth 형식은 YYYY-MM-DD", 400);
  }
  
  const age = calcAgeFromBirthYYYYMMDD(birth.replace(/-/g, ''));
  if (age < 0) return res.fail("VAL_400", "birth 형식은 YYYY-MM-DD", 400);
  if (age < 50) return res.fail("KYC_AGE_RESTRICTED", "가입은 만 50세 이상부터 가능합니다.", 403);

  // termsAccepted에서 필수 약관 확인
  const hasTos = termsAccepted.some((t: { key: string; version: string }) => t.key === 'tos');
  const hasPrivacy = termsAccepted.some((t: { key: string; version: string }) => t.key === 'privacy');
  if (!hasTos || !hasPrivacy) {
    return res.fail("VAL_400", "tos, privacy 약관 동의 필수", 400);
  }

  const kyc = await verifyKyc({ name, birth, carrier: session.carrier, phone });
  if (!kyc.ok) {
    const code = kyc.reason === "TEMPORARY_FAILURE" ? "KYC_TEMPORARY_FAILURE" : "KYC_MISMATCH";
    const status = kyc.reason === "TEMPORARY_FAILURE" ? 502 : 401;
    return res.fail(code, code === "KYC_MISMATCH" ? "본인정보 불일치" : "외부 연동 장애", status);
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
  // 임시로 테이블이 없으므로 refresh 토큰 저장 스킵
  console.log('[REGISTER] 리프레시 토큰 저장 스킵 (테이블 없음):', { jti, userId });
  // TODO: refresh_tokens 테이블 생성 후 활성화
  // await saveNewRefreshToken({ jti, userId, token: rt, expiresAt: new Date(Date.now()+30*24*60*60*1000) });
  setAuthCookies(res, at, rt);

  await completeAndDelete(phone);
  return res.ok({ userId, autoLogin: true }, "REGISTER_OK");
});
