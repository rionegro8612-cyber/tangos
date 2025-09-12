import { Router } from "express";
import { validate } from "../middlewares/validate";
import { SubmitSchema } from "./register.schemas";
import { AppError, ErrorCodes } from "../errors/AppError";
import { withIdempotency } from "../middlewares/idempotency";
import { getRedis } from "../lib/redis";
import dayjs from "dayjs";

const router = Router();

// KYC 최소 나이 제한
const KYC_MIN_AGE = Number(process.env.KYC_MIN_AGE) || 50;

router.post("/submit", withIdempotency(), validate(SubmitSchema), async (req, res, next) => {
  console.log(`[ROUTER DEBUG] /auth/register/submit 요청 처리 시작 - register.submit.ts`);
  
  try {
    // Redis 클라이언트 획득
    const redis = getRedis();
    
    const { profile, agreements, referralCode } = req.body;

    // 0) 가입 티켓 확인 (verify-code 이후 발급된 것)
    const phone = req.body.phone;  // 🚨 스키마에서 검증되므로 직접 사용
    if (!phone) {
      throw new AppError("PHONE_NOT_FOUND", 400, "Phone number is required");
    }

    const ticketKey = `otp:ticket:${phone}`;
    let ticket;
    
    console.log(`[DEBUG] 회원가입 티켓 조회 시작: ${ticketKey}`);
    console.log(`[DEBUG] 현재 전화번호: ${phone}`);
    
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
      // Redis 연결 실패 시 개발 환경에서는 임시로 통과 (기존 기능 보존)
      if (process.env.NODE_ENV === 'development') {
        console.log('[DEV] Redis unavailable, skipping ticket check');
        ticket = 'dev_ticket'; // 임시 값
      } else {
        throw new AppError("REDIS_UNAVAILABLE", 500, "Redis service unavailable");
      }
    }
    
    // 기존 로직: 티켓이 없으면 에러 (기존 기능 보존)
    if (!ticket) {
      console.error(`[ERROR] 티켓을 찾을 수 없음: ${ticketKey}`);
      throw new AppError("REG_TICKET_NOT_FOUND", 401, "Please verify phone first");
    }
    
    console.log(`[DEBUG] 티켓 검증 성공: ${ticketKey}`);

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
    // TODO: 실제 DB 연동 시 기존 로직과 통합
    const result = await createUserTransaction(phone, profile, agreements, referralCode);

    // 4) 가입 티켓 소멸
    try {
      await redis.del(ticketKey);
      console.log(`[DEBUG] 가입 티켓 삭제 성공: ${ticketKey}`);
    } catch (error) {
      console.error('Redis del error:', error);
      // Redis 연결 실패 시 개발 환경에서는 무시
      if (process.env.NODE_ENV !== 'development') {
        throw new AppError("REDIS_UNAVAILABLE", 500, "Redis service unavailable");
      }
    }

    // 5) 성공 응답
    res.ok(
      {
        user: result,
        phoneVerified: true,  // 🚨 프론트엔드에서 필요
      },
      "REGISTERED",
    );
  } catch (error: any) {
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
  profile: any,
  agreements: any[],
  referralCode?: string,
) {
  // TODO: 실제 DB 연동 시 기존 createUserWithKyc 로직과 통합
  console.log(`[REGISTER] Creating user: ${phone}, nickname: ${profile.nickname}`);

  // 임시로 성공 응답 (실제로는 DB에 저장)
  return {
    id: Math.floor(Math.random() * 10000),
    nickname: profile.nickname,
    region: profile.region,
    phone: phone,
  };
}

export default router;
