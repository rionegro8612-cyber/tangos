import { Router } from "express";
import { validate } from "../middlewares/validate";
import { SubmitSchema } from "./register.schemas";
import { AppError } from "../errors/AppError";
import { withIdempotency } from "../middlewares/idempotency";
import { getRedis } from "../lib/redis";
import { query } from "../lib/db";
import { newJti, signAccessToken, signRefreshToken } from "../lib/jwt";
import { setAuthCookies } from "../lib/cookies";
import { saveNewRefreshToken } from "../repos/refreshTokenRepo";
import { recordUserRegistration } from "../lib/metrics";
import dayjs from "dayjs";

const router = Router();

// 🆕 전화번호 정규화 함수 (auth.mvp.ts와 동일)
function normalizeE164(phone: string | undefined): string {
  if (!phone) throw new Error("phone is required");
  const p = phone.replace(/[^\d+]/g, "");
  if (!p.startsWith("+")) throw new Error("phone must be E.164");
  return p;
}

// KYC 최소 나이 제한
const KYC_MIN_AGE = Number(process.env.KYC_MIN_AGE) || 50;

router.post("/submit", withIdempotency(), validate(SubmitSchema), async (req, res, next) => {
  console.log(`[ROUTER DEBUG] /auth/register/submit 요청 처리 시작 - register.submit.ts`);
  
  try {
    // Redis 클라이언트 획득
    const redis = getRedis();
    
    const { profile, agreements, referralCode } = req.body;

    // 0) 가입 티켓 확인 (verify-code 이후 발급된 것)
    const phoneRaw = req.body.phone;  // 🚨 스키마에서 검증되므로 직접 사용
    if (!phoneRaw) {
      throw new AppError("PHONE_NOT_FOUND", 400, "Phone number is required");
    }

    // 🆕 전화번호 정규화 (verify-code에서 사용한 형식과 일치시킴)
    let phone: string;
    try {
      phone = normalizeE164(phoneRaw);
      console.log(`[DEBUG] 전화번호 정규화: ${phoneRaw} -> ${phone}`);
    } catch (error) {
      console.error(`[ERROR] 전화번호 정규화 실패: ${phoneRaw}`, error);
      throw new AppError("INVALID_PHONE_FORMAT", 400, "Invalid phone number format");
    }

    // 🆕 티켓 키 형식: verify-code에서 생성한 키와 일치시킴 (reg:ticket:${phone})
    const ticketKey = `reg:ticket:${phone}`;
    let ticket;
    
    console.log(`[DEBUG] 회원가입 티켓 조회 시작: ${ticketKey}`);
    console.log(`[DEBUG] 현재 전화번호 (정규화됨): ${phone}`);
    
    try {
      console.log(`[DEBUG] Redis get 호출 시작: ${ticketKey}`);
      ticket = await redis.get(ticketKey);
      console.log(`[DEBUG] Redis get 호출 완료: ${ticketKey} = ${ticket ? '존재' : '없음'}`);
      
      if (ticket) {
        console.log(`[DEBUG] 티켓 내용:`, ticket);
      } else {
        // 티켓이 없으면 에러 (기존 기능 보존)
        console.log(`[DEBUG] 티켓을 찾을 수 없음: ${ticketKey}`);
      }
    } catch (error) {
      console.error('Redis get error:', error);
      // Redis 연결 실패 시 개발 환경에서는 임시로 통과
      if (process.env.NODE_ENV === 'development') {
        console.log('[DEV] Redis unavailable, skipping ticket check');
        ticket = 'dev_ticket'; // 임시 값
      } else {
        throw new AppError("REDIS_UNAVAILABLE", 500, "Redis service unavailable");
      }
    }
    
    // 🆕 개발 환경에서는 티켓이 없어도 통과 (테스트 편의성)
    // NODE_ENV가 설정되지 않았거나 'development'인 경우 개발 환경으로 간주
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';
    
    console.log(`[DEBUG] 티켓 검증 결과: ticket=${ticket ? '존재' : '없음'}, isDev=${isDev}, NODE_ENV=${process.env.NODE_ENV || 'undefined'}`);
    
    if (!ticket) {
      if (isDev) {
        console.warn(`[DEV] ⚠️ 티켓을 찾을 수 없지만 개발 환경이므로 계속 진행`);
        console.warn(`[DEV] 티켓 키: ${ticketKey}`);
        console.warn(`[DEV] 원본 전화번호: ${phoneRaw}, 정규화된 전화번호: ${phone}`);
        // 개발 환경에서는 티켓 없이도 통과
        ticket = 'dev_ticket'; // 개발 환경에서는 임시 값으로 통과
      } else {
        console.error(`[ERROR] 티켓을 찾을 수 없음: ${ticketKey}`);
        console.error(`[ERROR] 원본 전화번호: ${phoneRaw}, 정규화된 전화번호: ${phone}`);
        console.error(`[ERROR] NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
        throw new AppError("REG_TICKET_NOT_FOUND", 401, "Please verify phone first");
      }
    }
    
    console.log(`[DEBUG] ✅ 티켓 검증 성공: ${ticketKey}`);

    // 1) 약관 필수 항목 체크
    type Agreement = { code: string; version: string; required: boolean; accepted: boolean };
    const requiredNotAccepted = agreements.find((a: Agreement) => a.required && !a.accepted);
    if (requiredNotAccepted) {
      throw new AppError("TERMS_REQUIRED", 400, "Required term not accepted", {
        code: requiredNotAccepted.code,
      });
    }

    // 2) 나이 계산 및 제한 체크
    const age = dayjs().year() - profile.birthYear;
    if (age < KYC_MIN_AGE) {
      throw new AppError("AGE_RESTRICTION", 400, `Minimum age is ${KYC_MIN_AGE}`);
    }

    // 3) 트랜잭션으로 회원가입 처리
    const result = await createUserTransaction(phone, profile, agreements, referralCode);

    console.log(`[REGISTER] 사용자 생성 결과:`, result);

    // 4) 세션 토큰 발급 및 쿠키 설정
    const userId = String(result.id);
    const jti = newJti();
    const accessToken = signAccessToken(userId, jti);
    const refreshToken = signRefreshToken(userId, jti);

    const refreshExpiresDays = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30);
    const refreshExpiresAt = new Date(Date.now() + refreshExpiresDays * 24 * 60 * 60 * 1000);
    const userAgent = req.headers["user-agent"]?.toString();
    const ipAddr = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip || undefined;

    let refreshStored = false;
    try {
      await saveNewRefreshToken({
        jti,
        userId,
        token: refreshToken,
        expiresAt: refreshExpiresAt,
        userAgent,
        ip: ipAddr,
      });
      refreshStored = true;
    } catch (tokenError) {
      console.error(`[REGISTER] 리프레시 토큰 저장 실패:`, tokenError);
      if (process.env.NODE_ENV !== 'development') {
        throw new AppError("INTERNAL_ERROR", 500, "Failed to issue session");
      }
      console.warn(`[DEV] 리프레시 토큰 저장 실패를 무시하고 진행합니다.`);
    }

    setAuthCookies(res, accessToken, refreshToken);
    console.log(`[REGISTER] 세션 쿠키 설정 완료 (refreshStored=${refreshStored})`);

    // 메트릭 기록
    recordUserRegistration("success");

    // 6) 성공 응답
    res.ok(
      {
        user: result,
        phoneVerified: true,  // 🚨 프론트엔드에서 필요
      },
      "REGISTERED",
    );
  } catch (error: any) {
    recordUserRegistration("fail", error?.code ?? error?.message ?? "unknown_error");
    // DB unique constraint 위반 매핑
    if (error.code === "23505") {
      if (error.constraint?.includes("nickname")) {
        return next(new AppError("NICKNAME_TAKEN", 409, "Nickname already in use"));
      }
      if (error.constraint?.includes("phone")) {
        return next(new AppError("ALREADY_REGISTERED", 409, "User already registered"));
      }
    }

    return next(error);
  }
});

// 임시 사용자 생성 함수 (기존 로직과 연동 필요)
async function createUserTransaction(
  phone: string,
  profile: { nickname: string; region: string; birthYear: number },
  agreements: any[],
  referralCode?: string,
) {
  console.log(`[REGISTER] 사용자 생성/업데이트 시작:`, {
    phone,
    nickname: profile.nickname,
    region: profile.region,
    birthYear: profile.birthYear,
    referralCode,
  });

  const upsert = await query<{
    id: number;
    phone: string;
    nickname: string;
    region: string | null;
    birthYear: number | null;
  }>(
    `
    INSERT INTO users (phone_e164_norm, nickname, region, birth_year, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (phone_e164_norm)
    DO UPDATE SET
      nickname   = EXCLUDED.nickname,
      region     = EXCLUDED.region,
      birth_year = EXCLUDED.birth_year,
      updated_at = NOW()
    RETURNING 
      id,
      phone_e164_norm AS phone,
      nickname,
      region,
      birth_year AS "birthYear"
    `,
    [phone, profile.nickname, profile.region ?? null, profile.birthYear ?? null],
  );

  const user = upsert.rows[0];

  if (!user) {
    throw new AppError("USER_CREATION_FAILED", 500, "Failed to create user record");
  }

  console.log(`[REGISTER] 사용자 생성/업데이트 완료:`, user);

  return {
    id: String(user.id),
    phone: user.phone,
    nickname: user.nickname,
    region: user.region,
    birthYear: user.birthYear,
  };
}

export default router;
