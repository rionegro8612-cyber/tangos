import { Router } from "express";
import { validate } from "../middlewares/validate";
import { PhoneSchema, VerifySchema } from "./auth.schemas";
import { AppError, ErrorCodes } from "../errors/AppError";
import { rateLimitSend, rateLimitVerify } from "../middlewares/rateLimit";
import { createClient } from "redis";

// Redis 클라이언트
const redis = createClient({
  url: process.env.REDIS_URL || "redis://redis:6379"
});

const router = Router();

// 임시 OTP 서비스 (기존 로직과 연동 예정)
const mockOtpService = {
  async send(phone: string) {
    // 실제로는 기존 OTP 서비스와 연동
    console.log(`[OTP] Sending SMS to ${phone}`);
    return {
      ok: true,
      ttl: 300, // 5분
      cooldown: 60
    };
  },
  
  async resend(phone: string) {
    console.log(`[OTP] Resending SMS to ${phone}`);
    return {
      ok: true,
      ttl: 300,
      retryAfter: 60
    };
  },
  
  async verify(phone: string, code: string) {
    // 실제로는 기존 검증 로직과 연동
    console.log(`[OTP] Verifying code ${code} for ${phone}`);
    
    // 임시 검증 로직 (123456 허용)
    if (code === "123456") {
      return {
        ok: true,
        user: { id: 1, phone },
        issueTokens: async () => ({ accessToken: "mock_token" })
      };
    }
    
    return {
      ok: false,
      reason: "INVALID",
      message: "Invalid verification code"
    };
  }
};

/** POST /api/v1/auth/send-sms */
router.post("/send-sms", rateLimitSend, validate(PhoneSchema), async (req, res, next) => {
  try {
    const { phone } = req.body;
    
    const result = await mockOtpService.send(phone);
    
    if (!result.ok) {
      throw new AppError(
        ErrorCodes.SMS_SEND_FAILED, 
        502, 
        "Failed to send SMS"
      );
    }
    
    res.ok({ 
      ttl: result.ttl, 
      cooldown: result.cooldown 
    });
    
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/auth/resend-sms */
router.post("/resend-sms", rateLimitSend, validate(PhoneSchema), async (req, res, next) => {
  try {
    const { phone } = req.body;
    
    const result = await mockOtpService.resend(phone);
    
    if (!result.ok) {
      throw new AppError(
        ErrorCodes.SMS_RESEND_BLOCKED, 
        429, 
        "SMS resend blocked",
        { retryAfter: result.retryAfter }
      );
    }
    
    res.ok({ 
      ttl: result.ttl, 
      retryAfter: result.retryAfter 
    });
    
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/auth/verify-code */
router.post("/verify-code", rateLimitVerify, validate(VerifySchema), async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    
    const result = await mockOtpService.verify(phone, code);
    
    if (!result.ok) {
      const errorMap: Record<string, { code: string; status: number }> = {
        INVALID: { code: ErrorCodes.AUTH_OTP_INVALID, status: 400 },
        EXPIRED: { code: ErrorCodes.AUTH_OTP_EXPIRED, status: 400 },
        TOO_MANY_ATTEMPTS: { code: ErrorCodes.AUTH_OTP_TOO_MANY_ATTEMPTS, status: 400 }
      };
      
      const error = errorMap[result.reason || "INVALID"] || { 
        code: ErrorCodes.AUTH_OTP_INVALID, 
        status: 400 
      };
      
      throw new AppError(
        error.code, 
        error.status, 
        result.message
      );
    }
    
    // 성공 시 가입 티켓 발급 (회원가입용)
    const ticketKey = `reg:ticket:${phone}`;
    const ticketData = {
      phone,
      verifiedAt: new Date().toISOString(),
      attempts: 1
    };
    
    // 가입 티켓을 Redis에 저장 (30분 TTL)
    await redis.setEx(ticketKey, 1800, JSON.stringify(ticketData));
    
    // 성공 응답 (가입 티켓 정보 포함)
    res.ok({ 
      user: result.user, 
      tokens: result.issueTokens ? await result.issueTokens() : null,
      registrationTicket: {
        expiresIn: 1800, // 30분
        message: "Phone verified. You can now complete registration."
      }
    });
    
  } catch (error) {
    next(error);
  }
});

export default router;
