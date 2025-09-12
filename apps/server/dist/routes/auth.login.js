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
exports.loginRouter = void 0;
const express_1 = require("express");
const jwt_1 = require("../lib/jwt");
const cookies_1 = require("../lib/cookies");
// // import { saveNewRefreshToken } from "../repos/refreshTokenRepo"; // 임시 비활성화 // 임시 비활성화
const userRepo_1 = require("../repos/userRepo");
const otp_service_1 = require("../services/otp.service");
const authJwt_1 = __importDefault(require("../middlewares/authJwt"));
const phone_1 = require("../lib/phone");
const metrics_1 = require("../lib/metrics");
exports.loginRouter = (0, express_1.Router)();
// 로그인용 OTP 발급
exports.loginRouter.post("/send-sms", async (req, res) => {
    const { phone } = req.body ?? {};
    if (!phone)
        return res.fail("VAL_400", "phone 필수", 400);
    const e164 = (0, phone_1.normalizeE164)(phone);
    let user = await (0, userRepo_1.findByPhone)(e164);
    // 테스트용: 사용자가 없으면 자동 생성 (실제 운영에서는 제거)
    if (!user) {
        console.log(`[DEV] 사용자 자동 생성: ${e164}`);
        // 간단한 사용자 생성 (실제로는 회원가입 플로우를 거쳐야 함)
        const { findOrCreateUserByPhoneE164 } = await Promise.resolve().then(() => __importStar(require("../repos/userRepo")));
        const userId = await findOrCreateUserByPhoneE164(e164);
        user = { id: userId };
    }
    const code = "" + Math.floor(100000 + Math.random() * 900000);
    await (0, otp_service_1.setOtp)(e164, code, "login", 300); // 5분 TTL
    // send via SMS vendor (mock in dev by default)
    if (process.env.NODE_ENV !== "test") {
        // SMS 전송 로직 (현재는 콘솔 출력)
        console.log(`[DEV] SMS to ${e164}: [Tango] 인증번호: ${code}`);
    }
    // 🆕 메트릭: OTP 전송 성공
    (0, metrics_1.recordOtpSend)("success", "MOCK", "unknown");
    const devCode = process.env.NODE_ENV !== "production" ? code : undefined;
    return res.ok({ issued: true, ttlSec: 300, ...(devCode ? { devCode } : {}) }, "OK");
});
// 로그인 OTP 검증 + 세션 발급
exports.loginRouter.post("/verify-login", async (req, res) => {
    const { phone, otp } = req.body ?? {};
    if (!phone || !otp)
        return res.fail("VAL_400", "phone, otp 필수", 400);
    const e164 = (0, phone_1.normalizeE164)(phone);
    const storedCode = await (0, otp_service_1.getOtp)(e164);
    if (!storedCode || storedCode !== otp) {
        // 🆕 메트릭: OTP 검증 실패
        (0, metrics_1.recordOtpVerify)("fail", "INVALID_CODE");
        return res.fail("INVALID_CODE", "인증번호가 올바르지 않거나 만료되었습니다.", 401);
    }
    // 🆕 메트릭: OTP 검증 성공
    (0, metrics_1.recordOtpVerify)("success", "VALID_CODE");
    // OTP 코드 삭제
    await (0, otp_service_1.delOtp)(e164);
    const user = await (0, userRepo_1.findByPhone)(e164);
    if (!user)
        return res.fail("USER_NOT_FOUND", "가입된 사용자가 없습니다.", 404);
    const jti = (0, jwt_1.newJti)();
    const at = (0, jwt_1.signAccessToken)(String(user.id), jti);
    const rt = (0, jwt_1.signRefreshToken)(String(user.id), jti);
    // 임시로 테이블이 없으므로 refresh 토큰 저장 스킵
    console.log("[LOGIN] 리프레시 토큰 저장 스킵 (테이블 없음):", { jti, userId: String(user.id) });
    // TODO: refresh_tokens 테이블 생성 후 활성화
    // await saveNewRefreshToken({
    //   jti, userId: String(user.id), token: rt,
    //   expiresAt: new Date(Date.now() + 30*24*60*60*1000),
    //   userAgent: req.headers["user-agent"]?.toString() ?? undefined,
    //   ip: req.ip ?? undefined,
    // });
    (0, cookies_1.setAuthCookies)(res, at, rt);
    // 🆕 메트릭: 사용자 로그인 성공
    (0, metrics_1.recordUserLogin)("success", "LOGIN_OK");
    return res.ok({ userId: String(user.id), autoLogin: true }, "LOGIN_OK");
});
// 프론트 요청 경로에 맞춰 /verify-code 추가 (verify-login과 동일)
exports.loginRouter.post("/verify-code", async (req, res) => {
    const { phone, code } = req.body ?? {};
    if (!phone || !code)
        return res.fail("VAL_400", "phone, code 필수", 400);
    const e164 = (0, phone_1.normalizeE164)(phone);
    const storedCode = await (0, otp_service_1.getOtp)(e164);
    if (!storedCode || storedCode !== code) {
        // 🆕 메트릭: OTP 검증 실패
        (0, metrics_1.recordOtpVerify)("fail", "INVALID_CODE");
        return res.fail("INVALID_CODE", "인증번호가 올바르지 않거나 만료되었습니다.", 401);
    }
    // 🆕 메트릭: OTP 검증 성공
    (0, metrics_1.recordOtpVerify)("success", "VALID_CODE");
    // OTP 코드 삭제
    await (0, otp_service_1.delOtp)(e164);
    const user = await (0, userRepo_1.findByPhone)(e164);
    if (!user)
        return res.fail("USER_NOT_FOUND", "가입된 사용자가 없습니다.", 404);
    const jti = (0, jwt_1.newJti)();
    const at = (0, jwt_1.signAccessToken)(String(user.id), jti);
    const rt = (0, jwt_1.signRefreshToken)(String(user.id), jti);
    // 임시로 테이블이 없으므로 refresh 토큰 저장 스킵
    console.log("[LOGIN] 리프레시 토큰 저장 스킵 (테이블 없음):", { jti, userId: String(user.id) });
    // TODO: refresh_tokens 테이블 생성 후 활성화
    // await saveNewRefreshToken({
    //   jti, userId: String(user.id), token: rt,
    //   expiresAt: new Date(Date.now() + 30*24*60*60*1000),
    //   userAgent: req.headers["user-agent"]?.toString() ?? undefined,
    //   ip: req.ip ?? undefined,
    // });
    (0, cookies_1.setAuthCookies)(res, at, rt);
    // 🆕 메트릭: 사용자 로그인 성공
    (0, metrics_1.recordUserLogin)("success", "LOGIN_OK");
    return res.ok({ userId: String(user.id), autoLogin: true }, "LOGIN_OK");
});
// 세션 확인
exports.loginRouter.get("/me", authJwt_1.default, async (req, res) => {
    if (!req.user?.id)
        return res.fail("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    // id로 사용자 조회 (id는 string 타입으로 변환)
    const user = await (0, userRepo_1.getUserProfile)(String(req.user.id));
    if (!user)
        return res.fail("USER_NOT_FOUND", "사용자를 찾을 수 없습니다.", 404);
    return res.ok({
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
    }, "OK");
});
