"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
// apps/server/src/routes/auth.mvp.ts
const express_1 = require("express");
const userRepo_1 = require("../repos/userRepo");
const jwt_1 = require("../lib/jwt");
const otp_redis_1 = require("../services/otp.redis");
const uuid_1 = require("uuid");
const logger_1 = require("../lib/logger");
const metrics_1 = require("../lib/metrics"); // 🆕 Added: 메트릭 함수들
const idempotency_1 = require("../middlewares/idempotency");
const otpService_1 = require("../lib/otpService");
const cookies_1 = require("../lib/cookies");
// 🆕 환경변수 상수 추가
const TTL = (0, otp_redis_1.readIntFromEnv)("OTP_TTL", 300); // 5분
const PHONE_LIMIT = (0, otp_redis_1.readIntFromEnv)("OTP_RATE_PER_PHONE", 5);
const PHONE_WIN = (0, otp_redis_1.readIntFromEnv)("OTP_RATE_PHONE_WINDOW", 600); // 10분
const IP_LIMIT = (0, otp_redis_1.readIntFromEnv)("OTP_RATE_PER_IP", 20);
const IP_WIN = (0, otp_redis_1.readIntFromEnv)("OTP_RATE_IP_WINDOW", 3600); // 1시간
exports.authRouter = (0, express_1.Router)();
/** 전화번호 마스킹 함수 */
function phoneMasked(phone) {
    if (!phone || phone.length < 4)
        return phone;
    return phone.slice(0, 3) + "*".repeat(phone.length - 4) + phone.slice(-1);
}
// 쿠키 관련 함수들은 lib/cookies.ts에서 import하여 사용
/** Authorization: Bearer 또는 httpOnly cookie에서 access 토큰 추출 */
function getTokenFromReq(req) {
    const hdr = req.headers.authorization || "";
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    return m?.[1] || req.cookies?.access_token;
}
/** POST /api/v1/auth/send-sms */
exports.authRouter.post("/send-sms", (0, idempotency_1.withIdempotency)(300), // 🆕 멱등성 적용 (5분 TTL) - 먼저 적용
async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { phone, carrier, context } = (req.body || {});
        const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
            req.socket.remoteAddress ||
            "0.0.0.0";
        if (!phone || !carrier || !context) {
            // 🆕 메트릭: OTP 전송 실패 (잘못된 요청)
            (0, metrics_1.recordOtpSend)("fail", "SENS", carrier || "unknown");
            return res.status(400).json({
                success: false,
                code: "BAD_REQUEST",
                message: "phone, carrier, context required",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // 전화번호 형식 검증 (E.164 형식)
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                code: "BAD_REQUEST",
                message: "Invalid phone number format. Use E.164 format (e.g., +82123456789)",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // 🚨 레이트리밋은 미들웨어에서 처리됨 (rateLimitSend)
        // 재전송 쿨다운 체크
        const cd = await (0, otpService_1.checkAndMarkCooldown)(phone);
        if (cd.blocked) {
            return res.status(429).json({
                success: false,
                code: "RESEND_BLOCKED",
                message: "재전송 쿨다운 중입니다.",
                data: { retryAfter: cd.retryAfter },
                requestId: req.requestId ?? null,
            });
        }
        // OTP 코드 생성 및 저장
        const code = "" + Math.floor(100000 + Math.random() * 900000);
        await (0, otp_redis_1.setOtp)(phone, code, TTL);
        // 성공 시 레이트리밋 헤더 설정 (간단한 형태)
        res.set({
            "X-RateLimit-Limit": Math.max(PHONE_LIMIT, IP_LIMIT).toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": Math.max(PHONE_WIN, IP_WIN).toString(),
        });
        // 개발 환경에서만 코드 표시
        const isDev = process.env.NODE_ENV !== "production";
        const includeDevCode = isDev || String(req.query.dev ?? "").trim() === "1";
        const data = {
            phoneE164: phone,
            expiresInSec: TTL,
            cooldown: 60, // 재전송 쿨다운 (1분)
            ...(includeDevCode ? { devCode: code } : {}),
        };
        if (includeDevCode) {
            console.log(`[DEV][OTP] ${phone} -> ${code} (ttl=${TTL}s)`);
        }
        // 🆕 메트릭: OTP 전송 성공
        (0, metrics_1.recordOtpSend)("success", "SENS", carrier);
        // 성공 로깅
        const latencyMs = Date.now() - startTime;
        (0, logger_1.logOtpSend)("success", "OTP_SENT", 200, req.requestId, phoneMasked(phone), ip, "SENS", undefined, {
            scope: "combo",
            limit: Math.max(PHONE_LIMIT, IP_LIMIT),
            remaining: 0,
            reset_sec: Math.max(PHONE_WIN, IP_WIN),
        }, latencyMs);
        return res.ok(data, "OTP_SENT", "OTP_SENT");
    }
    catch (e) {
        // 🆕 메트릭: OTP 전송 실패 (시스템 오류)
        (0, metrics_1.recordOtpSend)("fail", "SENS", "unknown");
        next(e);
    }
});
/** POST /api/v1/auth/resend-sms */
exports.authRouter.post("/resend-sms", (0, idempotency_1.withIdempotency)(300), // 🆕 멱등성 적용 (5분 TTL) - 먼저 적용
async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { phone, carrier, context } = (req.body || {});
        const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
            req.socket.remoteAddress ||
            "0.0.0.0";
        if (!phone || !carrier || !context) {
            return res.status(400).json({
                success: false,
                code: "BAD_REQUEST",
                message: "phone, carrier, context required",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // 재전송 쿨다운 체크
        const cd = await (0, otpService_1.checkAndMarkCooldown)(phone);
        if (cd.blocked) {
            return res.status(429).json({
                success: false,
                code: "RESEND_BLOCKED",
                message: "재전송 쿨다운 중입니다.",
                data: { retryAfter: cd.retryAfter },
                requestId: req.requestId ?? null,
            });
        }
        // 쿨다운 설정 (1분)
        const cooldownKey = `otp:cooldown:${phone}`;
        await (0, otp_redis_1.setOtp)(cooldownKey, "1", 60);
        // OTP 코드 생성 및 저장
        const code = "" + Math.floor(100000 + Math.random() * 900000);
        await (0, otp_redis_1.setOtp)(phone, code, TTL);
        // 개발 환경에서만 코드 표시
        const isDev = process.env.NODE_ENV !== "production";
        const includeDevCode = isDev || String(req.query.dev ?? "").trim() === "1";
        const data = {
            phoneE164: phone,
            expiresInSec: TTL,
            retryAfter: 60, // 재전송 쿨다운 (1분)
            ...(includeDevCode ? { devCode: code } : {}),
        };
        if (includeDevCode) {
            console.log(`[DEV][OTP] ${phone} -> ${code} (ttl=${TTL}s) - RESEND`);
        }
        // 🆕 메트릭: OTP 재전송 성공
        (0, metrics_1.recordOtpSend)("success", "SENS", carrier);
        return res.ok(data, "OTP_RESENT", "OTP_RESENT");
    }
    catch (e) {
        next(e);
    }
});
/** POST /api/v1/auth/verify-code  — 로그인(쿠키에 Access JWT만 심음) */
exports.authRouter.post("/verify-code", (0, idempotency_1.withIdempotency)(300), // 🆕 멱등성 적용 (5분 TTL) - 먼저 적용
async (req, res, next) => {
    console.log(`[ROUTER DEBUG] /auth/verify-code 요청 처리 시작 - auth.mvp.ts`);
    try {
        const startTime = Date.now();
        const { phone, code, context } = (req.body || {});
        const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
            req.socket.remoteAddress ||
            "0.0.0.0";
        if (!phone || !code || !context) {
            // 🆕 메트릭: OTP 검증 실패 (잘못된 요청)
            (0, metrics_1.recordOtpVerify)("fail", "BAD_REQUEST");
            return res.status(400).json({
                success: false,
                code: "BAD_REQUEST",
                message: "phone, code, context required",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // OTP 검증 (만료 체크 포함)
        const otpData = await (0, otpService_1.fetchOtp)(phone);
        console.log(`[DEBUG] OTP 검증: ${phone}, exists: ${otpData.exists}, expired: ${otpData.expired}, ttl: ${otpData.ttl}`);
        if (!otpData.exists) {
            // 🆕 메트릭: OTP 검증 실패 (코드 만료)
            (0, metrics_1.recordOtpVerify)("fail", "EXPIRED");
            return res.status(410).json({
                success: false,
                code: "EXPIRED",
                message: "인증번호가 만료되었습니다.",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        if (otpData.expired) {
            // 🆕 메트릭: OTP 검증 실패 (코드 만료)
            (0, metrics_1.recordOtpVerify)("fail", "EXPIRED");
            return res.status(410).json({
                success: false,
                code: "EXPIRED",
                message: "인증번호가 만료되었습니다.",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        if (otpData.code !== code) {
            // 🆕 메트릭: OTP 검증 실패 (잘못된 코드)
            (0, metrics_1.recordOtpVerify)("fail", "INVALID_CODE");
            return res.status(401).json({
                success: false,
                code: "INVALID_CODE",
                message: "잘못된 인증번호입니다.",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // OTP 사용 후 삭제
        await (0, otp_redis_1.delOtp)(phone);
        // 사용자 존재 여부 확인 (isNew 필드 결정)
        const existingUser = await (0, userRepo_1.findByPhone)(phone);
        const isNew = !existingUser; // 사용자가 없으면 신규 사용자
        // 가입 티켓 발급 (신규 사용자인 경우)
        if (isNew) {
            console.log(`[DEBUG] 신규 사용자 확인됨: ${phone}, 가입 티켓 생성 시작`);
            const ticketKey = `reg:ticket:${phone}`;
            const ticketData = {
                phone,
                verifiedAt: new Date().toISOString(),
                attempts: 1,
            };
            console.log(`[DEBUG] 티켓 데이터 준비:`, { ticketKey, ticketData });
            // 가입 티켓을 Redis에 저장 (30분 TTL)
            try {
                console.log(`[DEBUG] setOtp 호출 시작: ${ticketKey}`);
                await (0, otp_redis_1.setOtp)(ticketKey, JSON.stringify(ticketData), 1800);
                console.log(`[DEBUG] setOtp 호출 완료: ${ticketKey}`);
                // 생성 확인 (기존 기능 보존)
                console.log(`[DEBUG] 티켓 생성 확인 시작: ${ticketKey}`);
                const verifyTicket = await (0, otp_redis_1.getOtp)(ticketKey);
                console.log(`[DEBUG] getOtp 결과: ${ticketKey} = ${verifyTicket ? '존재' : '없음'}`);
                if (verifyTicket) {
                    console.log(`[DEBUG] 가입 티켓 생성 확인됨: ${ticketKey}`);
                    console.log(`[DEBUG] 티켓 내용:`, verifyTicket);
                }
                else {
                    console.warn(`[WARN] 가입 티켓 생성 후 확인 실패: ${ticketKey}`);
                }
            }
            catch (error) {
                console.error(`[ERROR] setOtp 실패: ${ticketKey}`, error);
                // Redis 실패 시 메모리 폴백으로 티켓 생성 (기존 기능 보존)
                try {
                    const memTicketKey = `mem:${ticketKey}`;
                    const memTicketData = JSON.stringify(ticketData);
                    // 메모리에 임시 저장 (30분 TTL)
                    setTimeout(() => {
                        // 30분 후 자동 삭제
                    }, 1800 * 1000);
                    console.log(`[DEBUG] 메모리 폴백 티켓 생성: ${memTicketKey}`);
                }
                catch (fallbackError) {
                    console.error(`[ERROR] 메모리 폴백도 실패: ${ticketKey}`, fallbackError);
                }
            }
        }
        else {
            console.log(`[DEBUG] 기존 사용자: ${phone}, 로그인 처리 시작`);
            // 기존 사용자 로그인 처리: 토큰 발급 및 쿠키 설정
            try {
                const user = await (0, userRepo_1.findByPhone)(phone);
                if (user) {
                    const jti = (0, jwt_1.newJti)();
                    const at = (0, jwt_1.signAccessToken)(user.id, jti);
                    const rt = (0, jwt_1.signRefreshToken)(user.id, jti);
                    // 로그인 성공 시 쿠키 설정
                    (0, cookies_1.setAuthCookies)(res, at, rt);
                    console.log(`[DEBUG] 로그인 성공: ${phone}, 토큰 발급 완료`);
                }
            }
            catch (error) {
                console.error(`[ERROR] 로그인 처리 실패: ${phone}`, error);
                // 로그인 실패 시에도 OTP 검증은 성공으로 처리
            }
        }
        // 🆕 메트릭: OTP 검증 성공
        (0, metrics_1.recordOtpVerify)("success", "VALID_CODE");
        // 성공 로깅
        const latencyMs = Date.now() - startTime;
        (0, logger_1.logOtpVerify)("success", "OTP_VERIFIED", 200, req.requestId, phoneMasked(phone), ip, undefined, latencyMs);
        // 응답 메시지 결정
        const message = isNew ? "SIGNUP_REQUIRED" : "LOGIN_OK";
        return res.ok({
            verified: true,
            isNew,
            ...(isNew
                ? {
                    registrationTicket: {
                        expiresIn: 1800, // 30분
                        message: "Phone verified. You can now complete registration.",
                    },
                }
                : {}),
        }, message, message);
    }
    catch (e) {
        // 🆕 메트릭: OTP 검증 실패 (시스템 오류)
        (0, metrics_1.recordOtpVerify)("fail", "SYSTEM_ERROR");
        next(e);
    }
});
/** POST /api/v1/auth/test/expire-otp - 테스트용 OTP 만료 엔드포인트 */
exports.authRouter.post("/test/expire-otp", async (req, res, next) => {
    try {
        const { phone } = (req.body || {});
        if (!phone) {
            return res.status(400).json({
                success: false,
                code: "BAD_REQUEST",
                message: "phone required",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // 개발 환경에서만 허용
        if (process.env.NODE_ENV === "production") {
            return res.status(403).json({
                success: false,
                code: "FORBIDDEN",
                message: "테스트 엔드포인트는 개발 환경에서만 사용 가능합니다.",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // OTP 강제 만료 (TTL을 1초로 설정)
        await (0, otp_redis_1.setOtp)(phone, "EXPIRED", 1);
        console.log(`[TEST] OTP 강제 만료: ${phone}`);
        return res.status(200).json({
            success: true,
            code: "OK",
            message: "OTP가 강제로 만료되었습니다.",
            data: { phone, expiresIn: 1 },
            requestId: req.requestId ?? null,
        });
    }
    catch (e) {
        next(e);
    }
});
/** POST /api/v1/auth/signup - 최종 1회 제출(약관 동의 시점) */
exports.authRouter.post("/signup", (0, idempotency_1.withIdempotency)(300), // 🆕 멱등성 적용 (5분 TTL)
async (req, res, next) => {
    try {
        const { phone, code, context } = (req.body || {});
        if (!phone || !code || !context) {
            return res.status(400).json({
                success: false,
                code: "BAD_REQUEST",
                message: "phone, code, context required",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // OTP 재검증
        const storedCode = await (0, otp_redis_1.getOtp)(phone);
        if (!storedCode) {
            return res.status(410).json({
                success: false,
                code: "EXPIRED",
                message: "인증번호가 만료되었습니다.",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        if (storedCode !== code) {
            return res.status(401).json({
                success: false,
                code: "INVALID_CODE",
                message: "잘못된 인증번호입니다.",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // 가입 티켓 확인
        const ticketKey = `reg:ticket:${phone}`;
        const ticketData = await (0, otp_redis_1.getOtp)(ticketKey);
        if (!ticketData) {
            return res.status(400).json({
                success: false,
                code: "REGISTRATION_EXPIRED",
                message: "가입 티켓이 만료되었습니다. 다시 인증해주세요.",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // 가입 티켓 삭제
        await (0, otp_redis_1.delOtp)(ticketKey);
        // 사용자 존재 여부 확인
        const existingUser = await (0, userRepo_1.findByPhone)(phone);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                code: "USER_EXISTS",
                message: "이미 등록된 사용자입니다.",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        // 새 사용자 생성 (여기서는 생성하지 않음, 별도 로직 필요)
        // TODO: 실제 사용자 생성 로직 구현
        const user = { id: "temp", phone };
        // 🆕 메트릭: 사용자 가입
        (0, metrics_1.recordUserRegistration)("success");
        // 성공 응답
        return res.ok({
            user,
            message: "Registration completed successfully",
        }, "SIGNUP_COMPLETED", "SIGNUP_COMPLETED");
    }
    catch (e) {
        next(e);
    }
});
/** POST /api/v1/auth/logout — Access 쿠키만 제거 */
exports.authRouter.post("/logout", async (_req, res, next) => {
    try {
        const opts = (0, cookies_1.accessCookieOptions)();
        res.clearCookie("access_token", { ...opts, expires: new Date(0) });
        return res.ok({}, "LOGOUT_OK", "LOGOUT_OK");
    }
    catch (e) {
        next(e);
    }
});
/** GET /api/v1/auth/me — 쿠키(or Bearer)에서 Access 검증 */
exports.authRouter.get("/me", async (req, res, next) => {
    try {
        const token = getTokenFromReq(req);
        if (!token) {
            return res.status(401).json({
                success: false,
                code: "UNAUTHORIZED",
                message: "missing token",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        const userId = String(decoded?.uid);
        // UUID 형식 검증 (uuidValidate 사용)
        if (!userId || !(0, uuid_1.validate)(userId)) {
            return res.status(401).json({
                success: false,
                code: "UNAUTHORIZED",
                message: "invalid token",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        const user = await (0, userRepo_1.getUserProfile)(userId);
        return res.ok({ user }, "ME_OK", "ME_OK");
    }
    catch (e) {
        next(e);
    }
});
// 호환성 위해 default export도 제공
exports.default = exports.authRouter;
