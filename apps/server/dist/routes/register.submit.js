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
const express_1 = require("express");
const validate_1 = require("../middlewares/validate");
const register_schemas_1 = require("./register.schemas");
const AppError_1 = require("../errors/AppError");
const idempotency_1 = require("../middlewares/idempotency");
const redis_1 = require("redis");
const dayjs_1 = __importDefault(require("dayjs"));
// Redis 클라이언트
const redis = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || "redis://localhost:6379",
});
// Redis 연결 상태 확인 및 연결
redis.on('error', (err) => console.error('Redis Client Error:', err));
redis.on('connect', () => console.log('Redis Client Connected'));
redis.on('ready', () => console.log('Redis Client Ready'));
redis.on('end', () => console.log('Redis Client Disconnected'));
// Redis 연결 상태 확인 함수 (필요할 때만 연결)
const ensureRedisConnection = async () => {
    if (!redis.isOpen) {
        try {
            await redis.connect();
            console.log('Redis reconnected');
        }
        catch (error) {
            console.error('Redis reconnection failed:', error);
        }
    }
    return redis.isOpen;
};
const router = (0, express_1.Router)();
// KYC 최소 나이 제한
const KYC_MIN_AGE = Number(process.env.KYC_MIN_AGE) || 50;
router.post("/submit", (0, idempotency_1.withIdempotency)(), (0, validate_1.validate)(register_schemas_1.SubmitSchema), async (req, res, next) => {
    console.log(`[ROUTER DEBUG] /auth/register/submit 요청 처리 시작 - register.submit.ts`);
    try {
        // Redis 연결 보장
        await ensureRedisConnection();
        const { profile, agreements, referralCode } = req.body;
        // 0) 가입 티켓 확인 (verify-code 이후 발급된 것)
        const phone = req.body.phone; // 🚨 스키마에서 검증되므로 직접 사용
        if (!phone) {
            throw new AppError_1.AppError("PHONE_NOT_FOUND", 400, "Phone number is required");
        }
        const ticketKey = `reg:ticket:${phone}`;
        let ticket;
        console.log(`[DEBUG] 회원가입 티켓 조회 시작: ${ticketKey}`);
        console.log(`[DEBUG] 현재 전화번호: ${phone}`);
        try {
            console.log(`[DEBUG] Redis get 호출 시작: ${ticketKey}`);
            ticket = await redis.get(ticketKey);
            console.log(`[DEBUG] Redis get 호출 완료: ${ticketKey} = ${ticket ? '존재' : '없음'}`);
            if (ticket) {
                console.log(`[DEBUG] 티켓 내용:`, ticket);
            }
            else {
                // setOtp로 생성된 키를 getOtp로 조회 시도
                console.log(`[DEBUG] Redis get 실패, getOtp로 재시도: ${ticketKey}`);
                const { getOtp } = await Promise.resolve().then(() => __importStar(require('../services/otp.redis')));
                const otpTicket = await getOtp(ticketKey);
                console.log(`[DEBUG] getOtp 결과: ${ticketKey} = ${otpTicket ? '존재' : '없음'}`);
                if (otpTicket) {
                    ticket = otpTicket;
                    console.log(`[DEBUG] getOtp로 티켓 찾음:`, otpTicket);
                }
            }
        }
        catch (error) {
            console.error('Redis get error:', error);
            // Redis 연결 실패 시 개발 환경에서는 임시로 통과 (기존 기능 보존)
            if (process.env.NODE_ENV === 'development') {
                console.log('[DEV] Redis unavailable, skipping ticket check');
                ticket = 'dev_ticket'; // 임시 값
            }
            else {
                throw new AppError_1.AppError("REDIS_UNAVAILABLE", 500, "Redis service unavailable");
            }
        }
        // 기존 로직: 티켓이 없으면 에러 (기존 기능 보존)
        if (!ticket) {
            console.error(`[ERROR] 티켓을 찾을 수 없음: ${ticketKey}`);
            throw new AppError_1.AppError("REG_TICKET_NOT_FOUND", 401, "Please verify phone first");
        }
        console.log(`[DEBUG] 티켓 검증 성공: ${ticketKey}`);
        const requiredNotAccepted = agreements.find((a) => a.required && !a.accepted);
        if (requiredNotAccepted) {
            throw new AppError_1.AppError("TERMS_REQUIRED", 400, "Required term not accepted", {
                code: requiredNotAccepted.code,
            });
        }
        // 2) 나이 계산 및 제한 체크
        const age = (0, dayjs_1.default)().year() - profile.birthYear;
        if (age < KYC_MIN_AGE) {
            throw new AppError_1.AppError("AGE_RESTRICTION", 400, `Minimum age is ${KYC_MIN_AGE}`);
        }
        // 3) 트랜잭션으로 회원가입 처리
        // TODO: 실제 DB 연동 시 기존 로직과 통합
        const result = await createUserTransaction(phone, profile, agreements, referralCode);
        // 4) 가입 티켓 소멸
        try {
            await ensureRedisConnection();
            await redis.del(ticketKey);
            console.log(`[DEBUG] 가입 티켓 삭제 성공: ${ticketKey}`);
        }
        catch (error) {
            console.error('Redis del error:', error);
            // Redis 연결 실패 시 개발 환경에서는 무시
            if (process.env.NODE_ENV !== 'development') {
                throw new AppError_1.AppError("REDIS_UNAVAILABLE", 500, "Redis service unavailable");
            }
        }
        // 5) 성공 응답
        res.ok({
            user: result,
            phoneVerified: true, // 🚨 프론트엔드에서 필요
        }, "REGISTERED");
    }
    catch (error) {
        // DB unique constraint 위반 매핑
        if (error.code === "23505") {
            if (error.constraint?.includes("nickname")) {
                return next(new AppError_1.AppError("NICKNAME_TAKEN", 409, "Nickname already in use"));
            }
            if (error.constraint?.includes("phone")) {
                return next(new AppError_1.AppError("ALREADY_REGISTERED", 409, "User already registered"));
            }
        }
        return next(error);
    }
});
// 임시 사용자 생성 함수 (기존 로직과 연동 필요)
async function createUserTransaction(phone, profile, agreements, referralCode) {
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
exports.default = router;
