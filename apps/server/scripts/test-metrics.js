#!/usr/bin/env node

/**
 * 관측 지표 테스트 스크립트
 *
 * 사용법:
 * - node scripts/test-metrics.js
 *
 * 검증 대상:
 * 1. http_requests_total (status별)
 * 2. http_request_duration_ms_bucket (p95 계산 가능)
 * 3. otp_verify_total{result=ok|invalid|expired|rate_limited|error}
 * 4. Prometheus/Grafana 대시보드 패널: p95, 5xx, 429, OTP invalid rate
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

// 환경 설정
const BASE_URL = process.env.BASE_URL || "http://localhost:4100";

console.log(`📊 관측 지표 테스트 시작`);
console.log(`📍 테스트 대상: ${BASE_URL}\n`);

// HTTP 요청 헬퍼 함수
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = client.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// 메트릭스 데이터 파싱 함수
function parseMetrics(metricsText) {
  const lines = metricsText.split("\n");
  const metrics = new Map();

  for (const line of lines) {
    if (line.startsWith("#") || !line.trim()) continue;

    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*(?:\{[^}]*\})?)?\s+([0-9.-]+)/);
    if (match) {
      const [, metricName, value] = match;
      if (metricName) {
        const cleanName = metricName.split("{")[0];
        if (!metrics.has(cleanName)) {
          metrics.set(cleanName, []);
        }
        metrics.get(cleanName).push({
          fullName: metricName,
          value: parseFloat(value),
          line: line,
        });
      }
    }
  }

  return metrics;
}

// 테스트 트래픽 생성
async function generateTestTraffic() {
  console.log("🔄 테스트 트래픽 생성 중...");

  try {
    // 1. 정상적인 요청들
    await makeRequest(`${BASE_URL}/health`);
    await makeRequest(`${BASE_URL}/api/v1/_ping`);

    // 2. SMS 전송 (성공)
    const smsResponse = await makeRequest(`${BASE_URL}/api/v1/auth/login/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "01012345678" }),
    });

    let devCode;
    if (smsResponse.status === 200) {
      try {
        const smsData = JSON.parse(smsResponse.data);
        devCode = smsData.data?.devCode;
      } catch (e) {
        console.log("  ⚠️  SMS 응답 파싱 실패");
      }
    }

    // 3. OTP 검증 (성공)
    if (devCode) {
      await makeRequest(`${BASE_URL}/api/v1/auth/login/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "01012345678", code: devCode }),
      });
    }

    // 4. OTP 검증 (실패 - 잘못된 코드)
    await makeRequest(`${BASE_URL}/api/v1/auth/login/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "01012345678", code: "000000" }),
    });

    // 5. 잘못된 요청 (400 에러)
    await makeRequest(`${BASE_URL}/api/v1/auth/login/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // phone 없음
    });

    // 6. 존재하지 않는 엔드포인트 (404 에러)
    await makeRequest(`${BASE_URL}/api/v1/nonexistent`);

    console.log("  ✅ 테스트 트래픽 생성 완료");

    // 메트릭 수집을 위해 잠시 대기
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    console.log(`  ❌ 테스트 트래픽 생성 실패: ${error.message}`);
  }
}

// 1. http_requests_total 검증
async function testHttpRequestsTotal(metrics) {
  console.log("\n📈 http_requests_total 지표 검증...");

  const httpRequestsTotal = metrics.get("http_requests_total") || [];

  if (httpRequestsTotal.length === 0) {
    console.log("  ❌ http_requests_total 지표가 없습니다");
    return false;
  }

  console.log("  📋 HTTP 요청 통계:");

  // Status별 분석
  const statusCounts = {};
  const methodCounts = {};

  httpRequestsTotal.forEach((metric) => {
    const statusMatch = metric.fullName.match(/status="(\d+)"/);
    const methodMatch = metric.fullName.match(/method="([^"]+)"/);

    if (statusMatch) {
      const status = statusMatch[1];
      statusCounts[status] = (statusCounts[status] || 0) + metric.value;
    }

    if (methodMatch) {
      const method = methodMatch[1];
      methodCounts[method] = (methodCounts[method] || 0) + metric.value;
    }
  });

  // Status별 출력
  Object.entries(statusCounts).forEach(([status, count]) => {
    const emoji = status.startsWith("2")
      ? "✅"
      : status.startsWith("4")
        ? "⚠️"
        : status.startsWith("5")
          ? "❌"
          : "📊";
    console.log(`    ${emoji} ${status}: ${count}개`);
  });

  // Method별 출력
  console.log("  📋 HTTP 메서드별:");
  Object.entries(methodCounts).forEach(([method, count]) => {
    console.log(`    📝 ${method}: ${count}개`);
  });

  return httpRequestsTotal.length > 0;
}

// 2. http_request_duration_ms_bucket 검증
async function testHttpRequestDuration(metrics) {
  console.log("\n⏱️ http_request_duration_ms_bucket 지표 검증...");

  const durationBuckets = metrics.get("http_request_duration_ms_bucket") || [];

  if (durationBuckets.length === 0) {
    console.log("  ❌ http_request_duration_ms_bucket 지표가 없습니다");
    return false;
  }

  console.log("  📋 HTTP 요청 지연시간 히스토그램:");

  // P95 계산을 위한 버킷 분석
  const buckets = {};
  durationBuckets.forEach((metric) => {
    const leMatch = metric.fullName.match(/le="([^"]+)"/);
    const statusMatch = metric.fullName.match(/status="(\d+)"/);

    if (leMatch && statusMatch) {
      const le = leMatch[1];
      const status = statusMatch[1];
      const key = `${status}`;

      if (!buckets[key]) buckets[key] = {};
      buckets[key][le] = metric.value;
    }
  });

  // 주요 status별 지연시간 분포 출력
  Object.entries(buckets).forEach(([status, bucket]) => {
    console.log(`    📊 Status ${status}:`);
    const relevantBuckets = ["10", "25", "50", "100", "200", "500", "1000", "+Inf"];
    relevantBuckets.forEach((le) => {
      if (bucket[le] !== undefined) {
        console.log(`      ≤ ${le}ms: ${bucket[le]}개`);
      }
    });
  });

  console.log("  ✅ P95 계산 가능한 히스토그램 데이터 확인됨");
  return true;
}

// 3. otp_verify_total 검증
async function testOtpVerifyTotal(metrics) {
  console.log("\n🔐 OTP 관련 지표 검증...");

  // OTP 전송 지표
  const otpSendTotal = metrics.get("otp_send_total") || [];
  console.log("  📤 OTP 전송 지표:");
  if (otpSendTotal.length > 0) {
    otpSendTotal.forEach((metric) => {
      console.log(`    ✅ ${metric.line}`);
    });
  } else {
    console.log("    ⚠️  otp_send_total 지표 없음");
  }

  // OTP 검증 지표
  const otpVerifyTotal = metrics.get("otp_verify_total") || [];
  console.log("  🔍 OTP 검증 지표:");
  if (otpVerifyTotal.length > 0) {
    const results = {};
    otpVerifyTotal.forEach((metric) => {
      const resultMatch = metric.fullName.match(/result="([^"]+)"/);
      if (resultMatch) {
        const result = resultMatch[1];
        results[result] = (results[result] || 0) + metric.value;
      }
      console.log(`    ✅ ${metric.line}`);
    });

    // 결과별 요약
    console.log("  📊 OTP 검증 결과 요약:");
    Object.entries(results).forEach(([result, count]) => {
      const emoji =
        result === "ok" ? "✅" : result === "invalid" ? "❌" : result === "expired" ? "⏰" : "⚠️";
      console.log(`    ${emoji} ${result}: ${count}개`);
    });
  } else {
    console.log("    ⚠️  otp_verify_total 지표 없음");
  }

  // OTP 실패 사유 지표
  const otpFailureReasons = metrics.get("otp_failure_reasons_total") || [];
  if (otpFailureReasons.length > 0) {
    console.log("  📋 OTP 실패 사유:");
    otpFailureReasons.forEach((metric) => {
      console.log(`    📝 ${metric.line}`);
    });
  }

  return otpSendTotal.length > 0 || otpVerifyTotal.length > 0;
}

// 4. 레이트 리밋 지표 검증
async function testRateLimitMetrics(metrics) {
  console.log("\n🚦 레이트 리밋 지표 검증...");

  const rateLimitExceeded = metrics.get("rate_limit_exceeded_total") || [];
  const rateLimitRemaining = metrics.get("rate_limit_remaining") || [];

  if (rateLimitExceeded.length > 0) {
    console.log("  📊 레이트 리밋 초과:");
    rateLimitExceeded.forEach((metric) => {
      console.log(`    ⚠️  ${metric.line}`);
    });
  } else {
    console.log("  ✅ 레이트 리밋 초과 없음");
  }

  if (rateLimitRemaining.length > 0) {
    console.log("  📊 레이트 리밋 잔여:");
    rateLimitRemaining.forEach((metric) => {
      console.log(`    📝 ${metric.line}`);
    });
  }

  return true;
}

// 5. 대시보드 패널 지표 검증
async function testDashboardPanels(metrics) {
  console.log("\n📊 Prometheus/Grafana 대시보드 패널 지표 검증...");

  // 1. P95 계산 가능성
  const durationBuckets = metrics.get("http_request_duration_ms_bucket") || [];
  const p95Available = durationBuckets.length > 0;
  console.log(`  📈 P95 지연시간 패널: ${p95Available ? "✅ 가능" : "❌ 불가능"}`);

  // 2. 5xx 에러율 계산 가능성
  const httpRequestsTotal = metrics.get("http_requests_total") || [];
  const has5xxErrors = httpRequestsTotal.some((m) => m.fullName.includes('status="5'));
  const has2xxSuccess = httpRequestsTotal.some((m) => m.fullName.includes('status="2'));
  const errorRateAvailable = httpRequestsTotal.length > 0;
  console.log(`  📉 5xx 에러율 패널: ${errorRateAvailable ? "✅ 가능" : "❌ 불가능"}`);
  if (has5xxErrors) console.log(`    ⚠️  5xx 에러 발생 감지됨`);
  if (has2xxSuccess) console.log(`    ✅ 2xx 성공 응답 확인됨`);

  // 3. 429 (레이트 리밋) 에러율
  const has429Errors = httpRequestsTotal.some((m) => m.fullName.includes('status="429'));
  console.log(`  🚦 429 에러율 패널: ${errorRateAvailable ? "✅ 가능" : "❌ 불가능"}`);
  if (has429Errors) console.log(`    ⚠️  429 레이트 리밋 에러 발생 감지됨`);
  else console.log(`    ✅ 429 에러 없음 (정상)`);

  // 4. OTP Invalid Rate
  const otpVerifyTotal = metrics.get("otp_verify_total") || [];
  const otpInvalidRateAvailable = otpVerifyTotal.length > 0;
  console.log(`  🔐 OTP Invalid Rate 패널: ${otpInvalidRateAvailable ? "✅ 가능" : "❌ 불가능"}`);

  return {
    p95: p95Available,
    errorRate5xx: errorRateAvailable,
    errorRate429: errorRateAvailable,
    otpInvalidRate: otpInvalidRateAvailable,
  };
}

// 메인 테스트 실행
async function runMetricsTest() {
  try {
    // 1. 테스트 트래픽 생성
    await generateTestTraffic();

    // 2. 메트릭스 수집
    console.log("\n📊 메트릭스 데이터 수집 중...");
    const response = await makeRequest(`${BASE_URL}/metrics`);

    if (response.status !== 200) {
      throw new Error(`메트릭스 엔드포인트 접근 실패: ${response.status}`);
    }

    const metrics = parseMetrics(response.data);
    console.log(`  ✅ ${metrics.size}개 메트릭 타입 수집됨`);

    // 3. 각 지표별 검증
    const results = {
      httpRequestsTotal: await testHttpRequestsTotal(metrics),
      httpRequestDuration: await testHttpRequestDuration(metrics),
      otpMetrics: await testOtpVerifyTotal(metrics),
      rateLimitMetrics: await testRateLimitMetrics(metrics),
      dashboardPanels: await testDashboardPanels(metrics),
    };

    // 4. 최종 결과 요약
    console.log("\n🎯 관측 지표 테스트 결과 요약:");
    console.log(`  📈 http_requests_total: ${results.httpRequestsTotal ? "✅ 정상" : "❌ 문제"}`);
    console.log(
      `  ⏱️ http_request_duration_ms_bucket: ${results.httpRequestDuration ? "✅ 정상" : "❌ 문제"}`,
    );
    console.log(`  🔐 OTP 관련 지표: ${results.otpMetrics ? "✅ 정상" : "❌ 문제"}`);
    console.log(`  🚦 레이트 리밋 지표: ${results.rateLimitMetrics ? "✅ 정상" : "❌ 문제"}`);

    console.log("\n📊 대시보드 패널 지원:");
    const panels = results.dashboardPanels;
    console.log(`  📈 P95 지연시간: ${panels.p95 ? "✅ 지원" : "❌ 미지원"}`);
    console.log(`  📉 5xx 에러율: ${panels.errorRate5xx ? "✅ 지원" : "❌ 미지원"}`);
    console.log(`  🚦 429 에러율: ${panels.errorRate429 ? "✅ 지원" : "❌ 미지원"}`);
    console.log(`  🔐 OTP Invalid Rate: ${panels.otpInvalidRate ? "✅ 지원" : "❌ 미지원"}`);

    const allGood = Object.values(results).every((r) =>
      typeof r === "boolean" ? r : Object.values(r).every(Boolean),
    );

    console.log(
      `\n🎉 전체 테스트 결과: ${allGood ? "✅ 모든 지표 정상" : "⚠️  일부 지표 확인 필요"}`,
    );
  } catch (error) {
    console.error("\n💥 테스트 실행 중 오류 발생:", error.message);
    process.exit(1);
  }
}

// 스크립트가 직접 실행될 때만 테스트 실행
if (require.main === module) {
  runMetricsTest();
}

module.exports = { runMetricsTest };
