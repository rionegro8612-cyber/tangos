#!/usr/bin/env node

// 메트릭 시스템 직접 테스트
const client = require("prom-client");

console.log("🧪 메트릭 시스템 직접 테스트");

// 메트릭 생성 (서버와 동일한 방식)
const otpVerifyTotal = new client.Counter({
  name: "test_otp_verify_total",
  help: "테스트용 OTP 검증 총 개수",
  labelNames: ["status", "reason"],
  registers: [client.register],
});

const otpFailureReasons = new client.Counter({
  name: "test_otp_failure_reasons_total",
  help: "테스트용 OTP 실패 사유별 카운트",
  labelNames: ["reason", "code"],
  registers: [client.register],
});

async function runTest() {
  try {
    console.log("📊 OTP 검증 성공 메트릭 기록...");
    otpVerifyTotal.labels("success", "VALID_CODE").inc();

    console.log("📊 OTP 검증 실패 메트릭 기록...");
    otpVerifyTotal.labels("fail", "INVALID_CODE").inc();

    console.log("📊 OTP 실패 사유 메트릭 기록...");
    otpFailureReasons.labels("INVALID_CODE", "OTP_VERIFY_FAIL").inc();

    console.log("✅ 메트릭 기록 완료");

    // 메트릭 출력
    const metrics = await client.register.metrics();
    console.log("\n📋 생성된 메트릭:");
    console.log(metrics);
  } catch (error) {
    console.error("❌ 메트릭 기록 실패:", error);
  }
}

runTest();
