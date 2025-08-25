
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

export const registerRouter = Router();

// KYC 최소 나이 제한
const KYC_MIN_AGE = Number(process.env.KYC_MIN_AGE) || 50;

// POST /api/v1/auth/register/start
registerRouter.post("/start", async (req, res) => {
  try {
    const { phone, carrier } = req.body;
    
    if (!phone || !carrier) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "phone, carrier required",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 1) 전화번호/통신사 받기 → signup_sessions upsert, OTP 발송
    const sessionKey = `reg:session:${phone}`;
    const sessionData = {
      phone,
      carrier,
      startedAt: new Date().toISOString(),
      status: 'started'
    };
    
    await redis.setex(sessionKey, 1800, JSON.stringify(sessionData)); // 30분 유효

    // 2) { requestId, ttlSec } 등 표준 응답
    return res.json({
      success: true,
      code: "OK",
      message: "REG_START_OK",
      data: {
        started: true,
        phone,
        carrier,
        ttlSec: 1800
      },
      requestId: (req as any).requestId ?? null,
    });

  } catch (error) {
    console.error("Register start error:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "서버 내부 오류",
      data: null,
      requestId: (req as any).requestId ?? null,
    });
  }
});

// POST /api/v1/auth/register/verify
registerRouter.post("/verify", async (req, res) => {
  try {
    const { phone, code, context } = req.body;
    
    if (!phone || !code || !context) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "phone, code, context required",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // OTP 검증
    const storedCode = await redis.get(phone);
    if (!storedCode || storedCode !== code) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CODE",
        message: "인증번호가 올바르지 않습니다.",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 1) OTP 검증 → signup_sessions.phone_verified = true
    const sessionKey = `reg:session:${phone}`;
    const sessionData = await redis.get(sessionKey);
    
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.phoneVerified = true;
      session.verifiedAt = new Date().toISOString();
      session.status = 'verified';
      
      await redis.setex(sessionKey, 1800, JSON.stringify(session));
    }

    // OTP 코드 삭제
    await redis.del(phone);

    // 2) { verified: true } 응답
    return res.json({
      success: true,
      code: "OK",
      message: "REG_VERIFY_OK",
      data: {
        verified: true,
        phone,
        context
      },
      requestId: (req as any).requestId ?? null,
    });

  } catch (error) {
    console.error("Register verify error:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "서버 내부 오류",
      data: null,
      requestId: (req as any).requestId ?? null,
    });
  }
});

// POST /api/v1/auth/register/complete
registerRouter.post("/complete", async (req, res) => {
  try {
    const { profile, agreements, referralCode } = req.body;
    const phone = (req as any).session?.phone || req.body.phone;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        code: "PHONE_NOT_FOUND",
        message: "Phone number not found",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 세션 확인
    const sessionKey = `reg:session:${phone}`;
    const sessionData = await redis.get(sessionKey);
    
    if (!sessionData) {
      return res.status(401).json({
        success: false,
        code: "SESSION_EXPIRED",
        message: "회원가입 세션이 만료되었습니다.",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    const session = JSON.parse(sessionData);
    if (!session.phoneVerified) {
      return res.status(401).json({
        success: false,
        code: "PHONE_NOT_VERIFIED",
        message: "전화번호 인증이 필요합니다.",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 1) 이름/생년월일/닉네임/약관 등 최종 수집
    if (!profile || !agreements) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "profile, agreements required",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 2) PASS KYC(50+ 확인) → 사용자 생성 → 토큰 발급(Set-Cookie)
    const age = dayjs().year() - profile.birthYear;
    if (age < KYC_MIN_AGE) {
      return res.status(403).json({
        success: false,
        code: "AGE_RESTRICTION",
        message: `가입은 만 ${KYC_MIN_AGE}세 이상부터 가능합니다.`,
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 약관 필수 항목 체크
    type Agreement = { code: string; version: string; required: boolean; accepted: boolean; };
    const requiredNotAccepted = agreements.find((a: Agreement) => a.required && !a.accepted);
    if (requiredNotAccepted) {
      return res.status(400).json({
        success: false,
        code: "TERMS_REQUIRED",
        message: "필수 약관에 동의해주세요.",
        data: { 
          code: requiredNotAccepted.code 
        },
        requestId: (req as any).requestId ?? null,
      });
    }

    // 3) 사용자 생성 (임시로 성공 응답)
    const user = {
      id: Math.floor(Math.random() * 10000),
      phone: phone,
      nickname: profile.nickname,
      birthYear: profile.birthYear,
      region: profile.region,
      age: age,
      createdAt: new Date().toISOString()
    };

    // 4) signup_sessions 정리
    await redis.del(sessionKey);

    // 5) 성공 응답
    return res.json({
      success: true,
      code: "OK",
      message: "REG_COMPLETE_OK",
      data: {
        registered: true,
        user: user
      },
      requestId: (req as any).requestId ?? null,
    });

  } catch (error) {
    console.error("Register complete error:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "서버 내부 오류",
      data: null,
      requestId: (req as any).requestId ?? null,
    });
  }
});

export default registerRouter;
