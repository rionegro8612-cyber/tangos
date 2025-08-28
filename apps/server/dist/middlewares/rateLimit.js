"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitVerify = exports.rateLimitSend = void 0;
const AppError_1 = require("../errors/AppError");
const redis_1 = require("redis");
// Redis 클라이언트 (기존 설정 재사용)
const redis = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || "redis://redis:6379"
});
// 레이트 리밋 설정
const RATE_LIMITS = {
    send: {
        perPhone: Number(process.env.OTP_RATE_PER_PHONE) || 5,
        perPhoneWindow: Number(process.env.OTP_RATE_PHONE_WINDOW) || 3600,
        perIP: Number(process.env.OTP_RATE_PER_IP) || 10,
        perIPWindow: Number(process.env.OTP_RATE_IP_WINDOW) || 3600,
        cooldown: Number(process.env.OTP_RESEND_COOLDOWN_SEC) || 60
    },
    verify: {
        perPhone: 10,
        perPhoneWindow: 3600,
        perIP: 20,
        perIPWindow: 3600
    }
};
// 레이트 리밋 체크 함수
async function checkRateLimit(key, limit, window) {
    const current = await redis.incr(key);
    if (current === 1) {
        await redis.expire(key, window);
    }
    const remaining = Math.max(0, limit - current);
    const resetTime = Date.now() + (window * 1000);
    return {
        allowed: current <= limit,
        remaining,
        resetTime
    };
}
// 전화번호별 레이트 리밋
const rateLimitSend = async (req, res, next) => {
    try {
        const { phone } = req.body;
        const ip = req.ip || req.connection.remoteAddress || "unknown";
        // 전화번호별 제한 체크
        const phoneKey = `rate_limit:send:phone:${phone}`;
        const phoneLimit = await checkRateLimit(phoneKey, RATE_LIMITS.send.perPhone, RATE_LIMITS.send.perPhoneWindow);
        if (!phoneLimit.allowed) {
            return next(new AppError_1.AppError(AppError_1.ErrorCodes.RATE_LIMITED, 429, "Too many SMS requests for this phone number", {
                retryAfter: Math.ceil((phoneLimit.resetTime - Date.now()) / 1000),
                remaining: phoneLimit.remaining
            }));
        }
        // IP별 제한 체크
        const ipKey = `rate_limit:send:ip:${ip}`;
        const ipLimit = await checkRateLimit(ipKey, RATE_LIMITS.send.perIP, RATE_LIMITS.send.perIPWindow);
        if (!ipLimit.allowed) {
            return next(new AppError_1.AppError(AppError_1.ErrorCodes.RATE_LIMITED, 429, "Too many SMS requests from this IP", {
                retryAfter: Math.ceil((ipLimit.resetTime - Date.now()) / 1000),
                remaining: ipLimit.remaining
            }));
        }
        // 쿨다운 체크 (재전송 방지)
        const cooldownKey = `cooldown:send:phone:${phone}`;
        const cooldown = await redis.get(cooldownKey);
        if (cooldown) {
            const remainingCooldown = Math.ceil(Number(cooldown) - Date.now() / 1000);
            return next(new AppError_1.AppError(AppError_1.ErrorCodes.SMS_RESEND_BLOCKED, 429, "Please wait before requesting another SMS", { retryAfter: remainingCooldown }));
        }
        // 쿨다운 설정
        await redis.setex(cooldownKey, RATE_LIMITS.send.cooldown, Date.now().toString());
        next();
    }
    catch (error) {
        console.error("Rate limit check failed:", error);
        next(); // 에러 발생 시 제한 없이 통과
    }
};
exports.rateLimitSend = rateLimitSend;
// 검증 레이트 리밋
const rateLimitVerify = async (req, res, next) => {
    try {
        const { phone } = req.body;
        const ip = req.ip || req.connection.remoteAddress || "unknown";
        // 전화번호별 제한 체크
        const phoneKey = `rate_limit:verify:phone:${phone}`;
        const phoneLimit = await checkRateLimit(phoneKey, RATE_LIMITS.verify.perPhone, RATE_LIMITS.verify.perPhoneWindow);
        if (!phoneLimit.allowed) {
            return next(new AppError_1.AppError(AppError_1.ErrorCodes.RATE_LIMITED, 429, "Too many verification attempts for this phone number", {
                retryAfter: Math.ceil((phoneLimit.resetTime - Date.now()) / 1000),
                remaining: phoneLimit.remaining
            }));
        }
        // IP별 제한 체크
        const ipKey = `rate_limit:verify:ip:${ip}`;
        const ipLimit = await checkRateLimit(ipKey, RATE_LIMITS.verify.perIP, RATE_LIMITS.verify.perIPWindow);
        if (!ipLimit.allowed) {
            return next(new AppError_1.AppError(AppError_1.ErrorCodes.RATE_LIMITED, 429, "Too many verification attempts from this IP", {
                retryAfter: Math.ceil((ipLimit.resetTime - Date.now()) / 1000),
                remaining: ipLimit.remaining
            }));
        }
        next();
    }
    catch (error) {
        console.error("Rate limit check failed:", error);
        next(); // 에러 발생 시 제한 없이 통과
    }
};
exports.rateLimitVerify = rateLimitVerify;
