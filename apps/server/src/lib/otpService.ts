// apps/server/src/lib/otpService.ts
/**
 * OTP 서비스 - 새로운 서비스로 위임
 * 키 스키마: otp:{context}:{E164}, otp:cooldown:{context}:{E164}
 */

import { checkAndMarkCooldown as cd, issueOtp as issue, verifyOtp as verify, fetchOtp as fetch } from "../services/otp.service";

// 기존 코드와의 호환성을 위한 래퍼 함수들
export const checkAndMarkCooldown = (phone: string, context = "register", sec = 60) => cd(phone, context, sec);
export const issueOtp = (phone: string, code: string, context = "register") => issue(phone, code, context);
export const verifyOtp = (phone: string, code: string, context = "register") => verify(phone, code, context);
export const fetchOtp = (phone: string, context = "register") => fetch(phone, context);

// 기존 코드와의 호환성을 위한 인터페이스들
export interface OtpSendResult {
  success: boolean;
  ttl: number;
  cooldown?: number;
  retryAfter?: number;
  message?: string;
}

export interface OtpVerifyResult {
  success: boolean;
  user?: any;
  message?: string;
}

// 전화번호 정규화 함수 (기존 코드와의 호환성)
export function normalizePhoneNumber(phone: string): string {
  // 한국 번호 정규화 (+82로 시작)
  let normalized = phone.replace(/\s+/g, "").replace(/-/g, "");

  if (normalized.startsWith("0")) {
    normalized = "+82" + normalized.substring(1);
  } else if (normalized.startsWith("82")) {
    normalized = "+" + normalized;
  } else if (!normalized.startsWith("+82")) {
    normalized = "+82" + normalized;
  }

  return normalized;
}
