#!/usr/bin/env node

// 간단한 메트릭 테스트
const client = require("prom-client");

async function runTest() {
  console.log("🧪 간단한 메트릭 테스트");

  // 메트릭 생성
  const testCounter = new client.Counter({
    name: "test_counter",
    help: "테스트용 카운터",
    labelNames: ["status"],
    registers: [client.register],
  });

  try {
    console.log("📊 테스트 메트릭 증가...");
    testCounter.labels("success").inc();
    testCounter.labels("fail").inc();

    console.log("✅ 메트릭 증가 완료");

    // 메트릭 출력
    const metrics = await client.register.metrics();
    console.log("\n📋 생성된 메트릭:");
    console.log(metrics);
  } catch (error) {
    console.error("❌ 메트릭 테스트 실패:", error);
  }
}

runTest();
