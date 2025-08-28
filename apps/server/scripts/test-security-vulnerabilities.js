#!/usr/bin/env node

/**
 * 보안 취약점 테스트 스크립트
 * 
 * 테스트 항목:
 * 1. 토큰 회전/무효화
 * 2. Rate Limit
 * 3. 멱등성 (Idempotency)
 * 
 * 사용법: node scripts/test-security-vulnerabilities.js
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

// 환경 설정
const BASE_URL = process.env.BASE_URL || "http://localhost:4100";
const TEST_PHONE = "01087654321";

console.log("🔒 보안 취약점 테스트 시작");
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

// 1. 토큰 회전/무효화 테스트
async function testTokenRotation() {
  console.log("🔄 토큰 회전/무효화 테스트...");

  try {
    // 1단계: SMS 발송으로 OTP 코드 받기
    console.log("  📱 1단계: SMS 발송...");
    const smsResponse = await makeRequest(`${BASE_URL}/api/v1/auth/login/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: TEST_PHONE }),
    });

    if (smsResponse.status !== 200) {
      console.log(`    ❌ SMS 발송 실패: ${smsResponse.status}`);
      return;
    }

    let devCode;
    try {
      const smsData = JSON.parse(smsResponse.data);
      devCode = smsData.data?.devCode;
    } catch (e) {
      console.log("    ❌ SMS 응답 파싱 실패");
      return;
    }

    if (!devCode) {
      console.log("    ❌ devCode를 찾을 수 없음");
      return;
    }

    console.log(`    ✅ OTP 코드: ${devCode}`);

    // 2단계: 로그인하여 토큰 받기
    console.log("  🔑 2단계: 로그인...");
    const loginResponse = await makeRequest(`${BASE_URL}/api/v1/auth/login/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: TEST_PHONE,
        code: devCode,
      }),
    });

    if (loginResponse.status !== 200) {
      console.log(`    ❌ 로그인 실패: ${loginResponse.status}`);
      return;
    }

    const cookies = loginResponse.headers["set-cookie"];
    if (!cookies) {
      console.log("    ❌ 쿠키를 받을 수 없음");
      return;
    }

    console.log("    ✅ 로그인 성공, 쿠키 획득");

    // 3단계: 토큰 무효화 테스트 (로그아웃)
    console.log("  🚫 3단계: 로그아웃...");
    const logoutResponse = await makeRequest(`${BASE_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies.join("; "),
      },
    });

    if (logoutResponse.status !== 200) {
      console.log(`    ❌ 로그아웃 실패: ${logoutResponse.status}`);
    } else {
      console.log("    ✅ 로그아웃 성공");
    }

    // 4단계: 무효화된 토큰으로 API 호출 시도
    console.log("  🧪 4단계: 무효화된 토큰 테스트...");
    const invalidTokenResponse = await makeRequest(`${BASE_URL}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        Cookie: cookies.join("; "),
      },
    });

    if (invalidTokenResponse.status === 401) {
      console.log("    ✅ 토큰 무효화 정상 작동");
    } else {
      console.log(`    ⚠️  토큰 무효화 확인 필요: ${invalidTokenResponse.status}`);
    }

  } catch (error) {
    console.log(`    ❌ 토큰 회전 테스트 실패: ${error.message}`);
  }
}

// 2. Rate Limit 테스트
async function testRateLimit() {
  console.log("\n⏱️  Rate Limit 테스트...");

  try {
    const requests = [];
    const maxRequests = 10; // 10초 내 10번 요청

    console.log(`  📊 ${maxRequests}번 연속 요청 시도...`);

    for (let i = 0; i < maxRequests; i++) {
      const request = makeRequest(`${BASE_URL}/api/v1/auth/login/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: TEST_PHONE }),
      });
      requests.push(request);
    }

    const responses = await Promise.all(requests);
    
    let successCount = 0;
    let rateLimitedCount = 0;
    let otherErrors = 0;

    responses.forEach((response, index) => {
      if (response.status === 200) {
        successCount++;
      } else if (response.status === 429) {
        rateLimitedCount++;
      } else {
        otherErrors++;
      }
    });

    console.log(`    📋 결과: 성공 ${successCount}, Rate Limited ${rateLimitedCount}, 기타 ${otherErrors}`);

    if (rateLimitedCount > 0) {
      console.log("    ✅ Rate Limit 정상 작동");
    } else {
      console.log("    ⚠️  Rate Limit 확인 필요");
    }

  } catch (error) {
    console.log(`    ❌ Rate Limit 테스트 실패: ${error.message}`);
  }
}

// 3. 멱등성 테스트
async function testIdempotency() {
  console.log("\n🔄 멱등성 테스트...");

  try {
    // 1단계: SMS 발송으로 OTP 코드 받기
    console.log("  📱 1단계: SMS 발송...");
    const smsResponse = await makeRequest(`${BASE_URL}/api/v1/auth/login/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: TEST_PHONE }),
    });

    if (smsResponse.status !== 200) {
      console.log(`    ❌ SMS 발송 실패: ${smsResponse.status}`);
      return;
    }

    let devCode;
    try {
      const smsData = JSON.parse(smsResponse.data);
      devCode = smsData.data?.devCode;
    } catch (e) {
      console.log("    ❌ SMS 응답 파싱 실패");
      return;
    }

    if (!devCode) {
      console.log("    ❌ devCode를 찾을 수 없음");
      return;
    }

    // 2단계: 동일한 OTP로 여러 번 로그인 시도
    console.log("  🔑 2단계: 동일 OTP로 여러 번 로그인 시도...");
    const loginAttempts = 3;
    const loginResponses = [];

    for (let i = 0; i < loginAttempts; i++) {
      const response = await makeRequest(`${BASE_URL}/api/v1/auth/login/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: TEST_PHONE,
          code: devCode,
        }),
      });
      loginResponses.push(response);
    }

    // 결과 분석
    const successCount = loginResponses.filter(r => r.status === 200).length;
    const errorCount = loginResponses.filter(r => r.status !== 200).length;

    console.log(`    📋 결과: 성공 ${successCount}, 실패 ${errorCount}`);

    if (successCount === 1 && errorCount === loginAttempts - 1) {
      console.log("    ✅ 멱등성 정상 작동 (OTP는 한 번만 사용 가능)");
    } else if (successCount === loginAttempts) {
      console.log("    ⚠️  멱등성 문제: OTP가 여러 번 사용됨");
    } else {
      console.log("    ⚠️  멱등성 확인 필요");
    }

  } catch (error) {
    console.log(`    ❌ 멱등성 테스트 실패: ${error.message}`);
  }
}

// 메인 테스트 실행
async function runTests() {
  try {
    await testTokenRotation();
    await testRateLimit();
    await testIdempotency();

    console.log("\n🎉 보안 취약점 테스트 완료!");
    console.log("\n📋 테스트 결과 요약:");
    console.log("  🔄 토큰 회전/무효화: 토큰 보안 강화 필요");
    console.log("  ⏱️  Rate Limit: API 보호 확인 필요");
    console.log("  🔄 멱등성: 중복 요청 방지 확인 필요");
  } catch (error) {
    console.error("\n💥 테스트 실행 중 오류 발생:", error);
    process.exit(1);
  }
}

// 스크립트가 직접 실행될 때만 테스트 실행
if (require.main === module) {
  runTests();
}

module.exports = {
  testTokenRotation,
  testRateLimit,
  testIdempotency,
  runTests,
};
