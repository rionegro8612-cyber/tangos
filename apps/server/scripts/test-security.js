#!/usr/bin/env node

/**
 * 보안 설정 테스트 스크립트
 *
 * 사용법:
 * - 개발 환경: node scripts/test-security.js
 * - 프로덕션 환경: NODE_ENV=production node scripts/test-security.js
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

// 환경 설정
const NODE_ENV = process.env.NODE_ENV || "development";
const BASE_URL = process.env.BASE_URL || "http://localhost:4100";

console.log(`🔒 보안 설정 테스트 시작 (${NODE_ENV} 환경)`);
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

// 테스트 함수들
async function testCORS() {
  console.log("🌐 CORS 설정 테스트...");

  try {
    const response = await makeRequest(`${BASE_URL}/health`, {
      method: "GET",
      headers: {
        Origin: "http://localhost:3000",
      },
    });

    const acao = response.headers["access-control-allow-origin"];
    const acac = response.headers["access-control-allow-credentials"];

    console.log(`  ✅ CORS Origin: ${acao || "Not set"}`);
    console.log(`  ✅ CORS Credentials: ${acac || "Not set"}`);

    if (acao === "http://localhost:3000" && acac === "true") {
      console.log("  🎯 CORS 설정 정상");
    } else {
      console.log("  ⚠️  CORS 설정 확인 필요");
    }
  } catch (error) {
    console.log(`  ❌ CORS 테스트 실패: ${error.message}`);
  }
}

async function testSecurityHeaders() {
  console.log("\n🛡️  보안 헤더 테스트...");

  try {
    const response = await makeRequest(`${BASE_URL}/health`);

    const headers = response.headers;
    const securityHeaders = {
      "X-Content-Type-Options": headers["x-content-type-options"],
      "X-Frame-Options": headers["x-frame-options"],
      "X-XSS-Protection": headers["x-xss-protection"],
      "Strict-Transport-Security": headers["strict-transport-security"],
      "Content-Security-Policy": headers["content-security-policy"],
      "Referrer-Policy": headers["referrer-policy"],
    };

    console.log("  📋 보안 헤더 확인:");
    Object.entries(securityHeaders).forEach(([header, value]) => {
      if (value) {
        console.log(
          `    ✅ ${header}: ${value.substring(0, 100)}${value.length > 100 ? "..." : ""}`,
        );
      } else {
        console.log(`    ⚠️  ${header}: 설정되지 않음`);
      }
    });
  } catch (error) {
    console.log(`  ❌ 보안 헤더 테스트 실패: ${error.message}`);
  }
}

async function testCookieSettings() {
  console.log("\n🍪 쿠키 설정 테스트...");

  try {
    // 먼저 SMS 발송으로 OTP 코드를 받습니다
    const smsResponse = await makeRequest(`${BASE_URL}/api/v1/auth/login/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        phone: "01087654321",
      }),
    });

    if (smsResponse.status !== 200) {
      console.log(`  ⚠️  SMS 발송 실패: ${smsResponse.status}`);
      return;
    }

    // SMS 응답에서 devCode를 추출합니다
    let devCode;
    try {
      const smsData = JSON.parse(smsResponse.data);
      console.log(`  📋 SMS 응답 데이터: ${JSON.stringify(smsData, null, 2)}`);
      devCode = smsData.data?.devCode;
    } catch (e) {
      console.log("  ⚠️  SMS 응답 파싱 실패");
      console.log(`  📋 원본 응답: ${smsResponse.data}`);
      return;
    }

    if (!devCode) {
      console.log("  ⚠️  devCode를 찾을 수 없음");
      return;
    }

    console.log(`  📱 OTP 코드: ${devCode}`);

    // 이제 로그인을 시도하여 쿠키를 받습니다
    const loginResponse = await makeRequest(`${BASE_URL}/api/v1/auth/login/verify-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        phone: "01087654321",
        code: devCode,
      }),
    });

    const setCookie = loginResponse.headers["set-cookie"];
    if (setCookie) {
      console.log("  ✅ Set-Cookie 헤더 존재");

      // 쿠키 옵션 분석
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      const secure = cookieStr.includes("Secure");
      const httpOnly = cookieStr.includes("HttpOnly");
      const sameSite = cookieStr.match(/SameSite=([^;]+)/)?.[1];

      console.log(`  📋 Secure: ${secure}`);
      console.log(`  📋 HttpOnly: ${httpOnly}`);
      console.log(`  📋 SameSite: ${sameSite || "Not set"}`);

      if (NODE_ENV === "production") {
        if (secure && sameSite === "None") {
          console.log("  🎯 프로덕션 쿠키 설정 정상");
        } else {
          console.log("  ⚠️  프로덕션 쿠키 설정 확인 필요");
        }
      } else {
        if (!secure && (sameSite === "Lax" || !sameSite)) {
          console.log("  🎯 개발 환경 쿠키 설정 정상");
        } else {
          console.log("  ⚠️  개발 환경 쿠키 설정 확인 필요");
        }
      }
    } else {
      console.log("  ⚠️  Set-Cookie 헤더 없음");
      console.log(`  📋 응답 상태: ${loginResponse.status}`);
      console.log(`  📋 응답 데이터: ${loginResponse.data.substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`  ❌ 쿠키 테스트 실패: ${error.message}`);
  }
}

async function testHTTPSRedirect() {
  if (NODE_ENV !== "production") {
    console.log("\n🔒 HTTPS 리다이렉트 테스트 (개발 환경에서는 생략)");
    return;
  }

  console.log("\n🔒 HTTPS 리다이렉트 테스트...");

  try {
    // HTTP로 요청 시 HTTPS로 리다이렉트되는지 확인
    const httpUrl = BASE_URL.replace("https://", "http://");
    const response = await makeRequest(httpUrl + "/health");

    if (response.status === 301 || response.status === 302) {
      const location = response.headers["location"];
      console.log(`  ✅ HTTPS 리다이렉트 정상: ${response.status} → ${location}`);
    } else {
      console.log(`  ⚠️  HTTPS 리다이렉트 확인 필요: ${response.status}`);
    }
  } catch (error) {
    console.log(`  ❌ HTTPS 리다이렉트 테스트 실패: ${error.message}`);
  }
}

// 메인 테스트 실행
async function runTests() {
  try {
    await testCORS();
    await testSecurityHeaders();
    await testCookieSettings();
    await testHTTPSRedirect();

    console.log("\n🎉 보안 설정 테스트 완료!");
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
  testCORS,
  testSecurityHeaders,
  testCookieSettings,
  testHTTPSRedirect,
  runTests,
};
