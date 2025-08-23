import { Router } from "express";
import { validate } from "../middlewares/validate";
import { SubmitSchema } from "./register.schemas";
import { AppError, ErrorCodes } from "../errors/AppError";
import { withIdempotency } from "../middlewares/idempotency";
import { createClient } from "redis";
import dayjs from "dayjs";

// Redis 클라이언트
const redis = createClient({
  url: process.env.REDIS_URL || "redis://redis:6379"
});

const router = Router();

// KYC 최소 나이 제한
const KYC_MIN_AGE = Number(process.env.KYC_MIN_AGE) || 50;

router.post("/submit", withIdempotency(), validate(SubmitSchema), async (req, res, next) => {
  const { profile, agreements, referralCode } = req.body;

  try {
    // 0) 가입 티켓 확인 (verify-code 이후 발급된 것)
    const phone = (req as any).session?.phone || req.body.phone;
    if (!phone) {
      throw new AppError("PHONE_NOT_FOUND", 400, "Phone number not found in session");
    }
    
    const ticketKey = `reg:ticket:${phone}`;
    const ticket = await redis.get(ticketKey);
    if (!ticket) {
      throw new AppError("REG_TICKET_NOT_FOUND", 401, "Please verify phone first");
    }

    // 1) 약관 필수 항목 체크
    type Agreement = { code: string; version: string; required: boolean; accepted: boolean; };
    const requiredNotAccepted = agreements.find((a: Agreement) => a.required && !a.accepted);
    if (requiredNotAccepted) {
      throw new AppError("TERMS_REQUIRED", 400, "Required term not accepted", { 
        code: requiredNotAccepted.code 
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
    await redis.del(ticketKey);

    // 5) 성공 응답
    res.ok({ 
      user: result 
    }, "REGISTERED");

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
  referralCode?: string
) {
  // TODO: 실제 DB 연동 시 기존 createUserWithKyc 로직과 통합
  console.log(`[REGISTER] Creating user: ${phone}, nickname: ${profile.nickname}`);
  
  // 임시로 성공 응답 (실제로는 DB에 저장)
  return {
    id: Math.floor(Math.random() * 10000),
    nickname: profile.nickname,
    region: profile.region,
    phone: phone
  };
}

export default router;
