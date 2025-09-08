"use strict";
// apps/server/src/lib/otpService.ts
/**
 * OTP 서비스 - 새로운 서비스로 위임
 * 키 스키마: otp:{context}:{E164}, otp:cooldown:{context}:{E164}
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchOtp = exports.verifyOtp = exports.issueOtp = exports.checkAndMarkCooldown = void 0;
exports.normalizePhoneNumber = normalizePhoneNumber;
const otp_service_1 = require("../services/otp.service");
// 기존 코드와의 호환성을 위한 래퍼 함수들
const checkAndMarkCooldown = (phone, context = "register", sec = 60) => (0, otp_service_1.checkAndMarkCooldown)(phone, context, sec);
exports.checkAndMarkCooldown = checkAndMarkCooldown;
const issueOtp = (phone, code, context = "register") => (0, otp_service_1.issueOtp)(phone, code, context);
exports.issueOtp = issueOtp;
const verifyOtp = (phone, code, context = "register") => (0, otp_service_1.verifyOtp)(phone, code, context);
exports.verifyOtp = verifyOtp;
const fetchOtp = (phone, context = "register") => (0, otp_service_1.fetchOtp)(phone, context);
exports.fetchOtp = fetchOtp;
// 전화번호 정규화 함수 (기존 코드와의 호환성)
function normalizePhoneNumber(phone) {
    // 한국 번호 정규화 (+82로 시작)
    let normalized = phone.replace(/\s+/g, "").replace(/-/g, "");
    if (normalized.startsWith("0")) {
        normalized = "+82" + normalized.substring(1);
    }
    else if (normalized.startsWith("82")) {
        normalized = "+" + normalized;
    }
    else if (!normalized.startsWith("+82")) {
        normalized = "+82" + normalized;
    }
    return normalized;
}
