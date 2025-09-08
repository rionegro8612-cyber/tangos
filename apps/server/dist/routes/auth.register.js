"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRouter = void 0;
const express_1 = require("express");
const redis_1 = require("../lib/redis");
const dayjs_1 = __importDefault(require("dayjs"));
exports.registerRouter = (0, express_1.Router)();
// KYC 최소 나이 제한
const KYC_MIN_AGE = Number(process.env.KYC_MIN_AGE) || 50;
// POST /api/v1/auth/register/start
exports.registerRouter.post("/start", async (req, res) => {
    try {
        const { phone, carrier } = req.body;
        if (!phone || !carrier) {
            return res.status(400).json({
                success: false,
                code: "BAD_REQUEST",
                message: "phone, carrier required",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // 1) 전화번호/통신사 받기 → signup_sessions upsert, OTP 발송
        const sessionKey = `reg:session:${phone}`;
        const sessionData = {
            phone,
            carrier,
            startedAt: new Date().toISOString(),
            status: "started",
        };
        const redis = await (0, redis_1.ensureRedis)();
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
                ttlSec: 1800,
            },
            requestId: req.requestId ?? null,
        });
    }
    catch (error) {
        console.error("Register start error:", error);
        return res.status(500).json({
            success: false,
            code: "INTERNAL_ERROR",
            message: "서버 내부 오류",
            data: null,
            requestId: req.requestId ?? null,
        });
    }
});
// POST /api/v1/auth/register/verify
exports.registerRouter.post("/verify", async (req, res) => {
    try {
        const { phone, code, context } = req.body;
        if (!phone || !code || !context) {
            return res.status(400).json({
                success: false,
                code: "BAD_REQUEST",
                message: "phone, code, context required",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // OTP 검증 (강화된 예외 처리)
        try {
            const { verifyOtp } = await Promise.resolve().then(() => __importStar(require("../services/otp.service")));
            const verifyResult = await verifyOtp(phone, code, "register");
            if (!verifyResult.ok) {
                console.log(`[register] OTP verification failed for ${phone}: ${verifyResult.code}`);
                if (verifyResult.code === "EXPIRED") {
                    return res.status(401).json({
                        success: false,
                        code: "EXPIRED_CODE",
                        message: "인증번호가 만료되었습니다.",
                        data: null,
                        requestId: req.requestId ?? null,
                    });
                }
                return res.status(401).json({
                    success: false,
                    code: "INVALID_CODE",
                    message: "인증번호가 올바르지 않습니다.",
                    data: null,
                    requestId: req.requestId ?? null,
                });
            }
            console.log(`[register] OTP verification success for ${phone}`);
        }
        catch (otpError) {
            console.error(`[register] OTP verification exception for ${phone}:`, otpError);
            return res.status(500).json({
                success: false,
                code: "INTERNAL_ERROR",
                message: "서버 내부 오류",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // 1) OTP 검증 → signup_sessions.phone_verified = true
        try {
            const sessionKey = `reg:session:${phone}`;
            const redisClient = await (0, redis_1.ensureRedis)();
            const sessionData = await redisClient.get(sessionKey);
            if (sessionData) {
                const session = JSON.parse(sessionData);
                session.phoneVerified = true;
                session.verifiedAt = new Date().toISOString();
                session.status = "verified";
                await redisClient.setex(sessionKey, 1800, JSON.stringify(session));
                console.log(`[register] Session updated for ${phone}: phoneVerified=true`);
            }
            else {
                console.log(`[register] No session found for ${phone}`);
            }
            // OTP는 이미 verifyOtp에서 삭제됨
        }
        catch (redisError) {
            console.error(`[register] Redis operation failed for ${phone}:`, redisError);
            // Redis 오류가 있어도 OTP 검증은 성공으로 처리 (이미 검증됨)
        }
        // 🚨 회원가입 티켓 생성 (register.submit에서 필요)
        const ticketKey = `reg:ticket:${phone}`;
        const ticketData = {
            phone,
            verifiedAt: new Date().toISOString(),
            context,
            status: "verified"
        };
        console.log(`[DEBUG] 가입 티켓 생성 시도: ${ticketKey}`, ticketData);
        try {
            const redis = await (0, redis_1.ensureRedis)();
            await redis.setex(ticketKey, 1800, JSON.stringify(ticketData)); // 30분 유효
            console.log(`[DEBUG] 가입 티켓 생성 성공: ${ticketKey}`);
            // 생성 확인
            const verifyTicket = await redis.get(ticketKey);
            console.log(`[DEBUG] 티켓 생성 확인: ${ticketKey} = ${verifyTicket ? '존재' : '없음'}`);
        }
        catch (error) {
            console.error(`[ERROR] 티켓 생성 실패: ${ticketKey}`, error);
        }
        // 2) { verified: true } 응답
        return res.json({
            success: true,
            code: "OK",
            message: "REG_VERIFY_OK",
            data: {
                verified: true,
                phone,
                context,
            },
            requestId: req.requestId ?? null,
        });
    }
    catch (error) {
        console.error("Register verify error:", error);
        return res.status(500).json({
            success: false,
            code: "INTERNAL_ERROR",
            message: "서버 내부 오류",
            data: null,
            requestId: req.requestId ?? null,
        });
    }
});
// POST /api/v1/auth/register/complete
exports.registerRouter.post("/complete", async (req, res) => {
    try {
        const { profile, agreements, referralCode } = req.body;
        const phone = req.session?.phone || req.body.phone;
        if (!phone) {
            return res.status(400).json({
                success: false,
                code: "PHONE_NOT_FOUND",
                message: "Phone number not found",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // 세션 확인
        const sessionKey = `reg:session:${phone}`;
        const redis = await (0, redis_1.ensureRedis)();
        const sessionData = await redis.get(sessionKey);
        if (!sessionData) {
            return res.status(401).json({
                success: false,
                code: "SESSION_EXPIRED",
                message: "회원가입 세션이 만료되었습니다.",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        const session = JSON.parse(sessionData);
        if (!session.phoneVerified) {
            return res.status(401).json({
                success: false,
                code: "PHONE_NOT_VERIFIED",
                message: "전화번호 인증이 필요합니다.",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // 1) 이름/생년월일/닉네임/약관 등 최종 수집
        if (!profile || !agreements) {
            return res.status(400).json({
                success: false,
                code: "BAD_REQUEST",
                message: "profile, agreements required",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // 2) PASS KYC(50+ 확인) → 사용자 생성 → 토큰 발급(Set-Cookie)
        const age = (0, dayjs_1.default)().year() - profile.birthYear;
        if (age < KYC_MIN_AGE) {
            return res.status(403).json({
                success: false,
                code: "AGE_RESTRICTION",
                message: `가입은 만 ${KYC_MIN_AGE}세 이상부터 가능합니다.`,
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        const requiredNotAccepted = agreements.find((a) => a.required && !a.accepted);
        if (requiredNotAccepted) {
            return res.status(400).json({
                success: false,
                code: "TERMS_REQUIRED",
                message: "필수 약관에 동의해주세요.",
                data: {
                    code: requiredNotAccepted.code,
                },
                requestId: req.requestId ?? null,
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
            createdAt: new Date().toISOString(),
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
                user: user,
            },
            requestId: req.requestId ?? null,
        });
    }
    catch (error) {
        console.error("Register complete error:", error);
        return res.status(500).json({
            success: false,
            code: "INTERNAL_ERROR",
            message: "서버 내부 오류",
            data: null,
            requestId: req.requestId ?? null,
        });
    }
});
exports.default = exports.registerRouter;
