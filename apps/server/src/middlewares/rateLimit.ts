import { Request, Response, NextFunction } from "express";
import { AppError, ErrorCodes } from "../errors/AppError";
import { ensureRedis } from "../lib/redis";

// 레이트 리밋 설정
const RATE_LIMITS = {
  send: {
    perPhone: Number(process.env.OTP_RATE_PER_PHONE) || 5,
    perPhoneWindow: Number(process.env.OTP_RATE_PHONE_WINDOW) || 3600,
    perIP: Number(process.env.OTP_RATE_PER_IP) || 10,
    perIPWindow: Number(process.env.OTP_RATE_IP_WINDOW) || 3600,
    cooldown: Number(process.env.OTP_RESEND_COOLDOWN_SEC) || 60,
  },
  verify: {
    perPhone: 10,
    perPhoneWindow: 3600,
    perIP: 20,
    perIPWindow: 3600,
  },
};

// 레이트 리밋 체크 함수
async function checkRateLimit(
  key: string,
  limit: number,
  window: number,
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const redisClient = await ensureRedis();
  const current = await redisClient.incr(key);

  if (current === 1) {
    await redisClient.expire(key, window);
  }

  const remaining = Math.max(0, limit - current);
  const resetTime = Date.now() + window * 1000;

  return {
    allowed: current <= limit,
    remaining,
    resetTime,
  };
}

// 전화번호별 레이트 리밋
export const rateLimitSend = async (req: Request, res: Response, next: NextFunction) => {
  // 개발 환경에서 Rate Limit 비활성화 (테스트 편의성)
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_RATE_LIMIT === 'true') {
    return next();
  }
  
  try {
    const { phone } = req.body;
    const ip = req.ip || req.connection.remoteAddress || "unknown";

    // 전화번호별 제한 체크
    const phoneKey = `rate_limit:send:phone:${phone}`;
    const phoneLimit = await checkRateLimit(
      phoneKey,
      RATE_LIMITS.send.perPhone,
      RATE_LIMITS.send.perPhoneWindow,
    );

    if (!phoneLimit.allowed) {
      return next(
        new AppError(ErrorCodes.RATE_LIMITED, 429, "Too many SMS requests for this phone number", {
          retryAfter: Math.ceil((phoneLimit.resetTime - Date.now()) / 1000),
          remaining: phoneLimit.remaining,
        }),
      );
    }

    // IP별 제한 체크
    const ipKey = `rate_limit:send:ip:${ip}`;
    const ipLimit = await checkRateLimit(
      ipKey,
      RATE_LIMITS.send.perIP,
      RATE_LIMITS.send.perIPWindow,
    );

    if (!ipLimit.allowed) {
      return next(
        new AppError(ErrorCodes.RATE_LIMITED, 429, "Too many SMS requests from this IP", {
          retryAfter: Math.ceil((ipLimit.resetTime - Date.now()) / 1000),
          remaining: ipLimit.remaining,
        }),
      );
    }

    // 쿨다운 체크 (재전송 방지)
    const cooldownKey = `cooldown:send:phone:${phone}`;
    const redisClient = await ensureRedis();
    const cooldown = await redisClient.get(cooldownKey);

    if (cooldown) {
      const cooldownTime = Number(cooldown);
      const remainingCooldown = Math.ceil((cooldownTime + RATE_LIMITS.send.cooldown * 1000 - Date.now()) / 1000);
      
      if (remainingCooldown > 0) {
        return next(
          new AppError(
            ErrorCodes.SMS_RESEND_BLOCKED,
            429,
            "재전송 쿨다운 중입니다.",
            { retryAfter: remainingCooldown },
          ),
        );
      }
    }

    // 쿨다운 설정 (현재 시간을 저장)
    await redisClient.setEx(cooldownKey, RATE_LIMITS.send.cooldown, Date.now().toString());

    next();
  } catch (error) {
    console.error("Rate limit check failed:", error);
    next(); // 에러 발생 시 제한 없이 통과
  }
};

// 검증 레이트 리밋
export const rateLimitVerify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body;
    const ip = req.ip || req.connection.remoteAddress || "unknown";

    // 전화번호별 제한 체크
    const phoneKey = `rate_limit:verify:phone:${phone}`;
    const phoneLimit = await checkRateLimit(
      phoneKey,
      RATE_LIMITS.verify.perPhone,
      RATE_LIMITS.verify.perPhoneWindow,
    );

    if (!phoneLimit.allowed) {
      return next(
        new AppError(
          ErrorCodes.RATE_LIMITED,
          429,
          "Too many verification attempts for this phone number",
          {
            retryAfter: Math.ceil((phoneLimit.resetTime - Date.now()) / 1000),
            remaining: phoneLimit.remaining,
          },
        ),
      );
    }

    // IP별 제한 체크
    const ipKey = `rate_limit:verify:ip:${ip}`;
    const ipLimit = await checkRateLimit(
      ipKey,
      RATE_LIMITS.verify.perIP,
      RATE_LIMITS.verify.perIPWindow,
    );

    if (!ipLimit.allowed) {
      return next(
        new AppError(ErrorCodes.RATE_LIMITED, 429, "Too many verification attempts from this IP", {
          retryAfter: Math.ceil((ipLimit.resetTime - Date.now()) / 1000),
          remaining: ipLimit.remaining,
        }),
      );
    }

    next();
  } catch (error) {
    console.error("Rate limit check failed:", error);
    next(); // 에러 발생 시 제한 없이 통과
  }
};
