#!/usr/bin/env node

// OTP 메트릭 직접 테스트
const { recordOtpVerify, recordOtpSend } = require("../src/lib/metrics");

console.log("🧪 OTP 메트릭 직접 테스트");

try {
  console.log("📊 OTP 전송 메트릭 기록...");
  recordOtpSend("success", "TEST", "SKT");

  console.log("📊 OTP 검증 성공 메트릭 기록...");
  recordOtpVerify("success", "VALID_CODE");

  console.log("📊 OTP 검증 실패 메트릭 기록...");
  recordOtpVerify("fail", "INVALID_CODE");

  console.log("✅ 메트릭 기록 완료");
  console.log("📍 http://localhost:4100/metrics 에서 확인하세요");
} catch (error) {
  console.error("❌ 메트릭 기록 실패:", error);
}
