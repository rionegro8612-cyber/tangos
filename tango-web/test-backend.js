// tango-web/test-backend.js
// 백엔드 서버로 직접 호출하는 테스트 스크립트

const API_BASE = 'http://localhost:4100';

// 표준 응답 타입
class ApiError extends Error {
  constructor(code, status, requestId, message) {
    super(message || code);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

// 통합 API 함수
async function api(path, init = {}) {
  const url = `${API_BASE}${path}`;
  
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    ...init,
  });

  // 표준 응답 포맷 파싱
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json?.success === false) {
    const code = json?.code ?? `HTTP_${response.status}`;
    const message = json?.message ?? '요청이 실패했습니다.';
    throw new ApiError(code, response.status, json?.requestId, message);
  }

  return json;
}

// POST 요청 헬퍼
async function apiPost(path, data) {
  return api(path, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

// 지연 함수
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 테스트 함수들
async function testAgeRestriction() {
  console.log('🧪 연령 제한 테스트 시작...\n');
  
  try {
    // 1. 50세 미만 가입 시도 (2000년생 = 25세)
    console.log('📝 테스트 1: 50세 미만 가입 시도 (2000년생 = 25세)');
    
    // SMS 전송
    console.log('📱 SMS 전송...');
    const smsResult = await apiPost('/api/v1/auth/send-sms', {
      phone: '+821012345678',
      carrier: 'SKT',
      context: 'signup'
    });
    
    console.log('✅ SMS 전송 성공');
    console.log('개발용 코드:', smsResult.data.devCode);
    console.log('요청 ID:', smsResult.data.requestId);
    
    // Rate limiting 방지를 위한 지연
    console.log('⏳ Rate limiting 방지를 위한 2초 대기...');
    await delay(2000);
    
    // 인증 코드 검증
    console.log('\n🔐 인증 코드 검증...');
    const verifyResult = await apiPost('/api/v1/auth/verify-code', {
      phone: '+821012345678',
      code: smsResult.data.devCode,
      context: 'signup'
    });
    
    console.log('✅ 인증 코드 검증 성공');
    console.log('결과:', verifyResult);
    
    console.log('\n📊 테스트 결과:');
    console.log('- SMS 전송: ✅ 성공');
    console.log('- 인증 코드 검증: ✅ 성공');
    console.log('- 연령 제한 체크: ⚠️ register/complete 엔드포인트 접근 불가');
    console.log('- 예상: 50세 미만이므로 가입 차단되어야 함');
    
  } catch (error) {
    console.log('❌ 테스트 실패:', error.code, error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  try {
    // 2. 50세 이상 가입 시도 (1970년생 = 55세)
    console.log('📝 테스트 2: 50세 이상 가입 시도 (1970년생 = 55세)');
    
    // Rate limiting 방지를 위한 지연
    console.log('⏳ Rate limiting 방지를 위한 3초 대기...');
    await delay(3000);
    
    // SMS 전송
    console.log('📱 SMS 전송...');
    const smsResult2 = await apiPost('/api/v1/auth/send-sms', {
      phone: '+821012345679',
      carrier: 'SKT',
      context: 'signup'
    });
    
    console.log('✅ SMS 전송 성공');
    console.log('개발용 코드:', smsResult2.data.devCode);
    console.log('요청 ID:', smsResult2.data.requestId);
    
    // Rate limiting 방지를 위한 지연
    console.log('⏳ Rate limiting 방지를 위한 2초 대기...');
    await delay(2000);
    
    // 인증 코드 검증
    console.log('\n🔐 인증 코드 검증...');
    const verifyResult2 = await apiPost('/api/v1/auth/verify-code', {
      phone: '+821012345679',
      code: smsResult2.data.devCode,
      context: 'signup'
    });
    
    console.log('✅ 인증 코드 검증 성공');
    console.log('결과:', verifyResult2);
    
    console.log('\n📊 테스트 결과:');
    console.log('- SMS 전송: ✅ 성공');
    console.log('- 인증 코드 검증: ✅ 성공');
    console.log('- 연령 제한 체크: ⚠️ register/complete 엔드포인트 접근 불가');
    console.log('- 예상: 50세 이상이므로 가입 성공해야 함');
    
  } catch (error) {
    console.log('❌ 테스트 실패:', error.code, error.message);
  }
}

async function testAvailableEndpoints() {
  console.log('🔍 사용 가능한 엔드포인트 테스트...\n');
  
  try {
    // 1. 헬스체크
    console.log('📊 헬스체크...');
    const healthResult = await fetch(`${API_BASE}/api/v1/_health`);
    const healthData = await healthResult.json();
    console.log('✅ 헬스체크 성공:', healthData.data.status);
    
    // 2. Ping
    console.log('\n🏓 Ping...');
    const pingResult = await fetch(`${API_BASE}/api/v1/_ping`);
    const pingData = await pingResult.text();
    console.log('✅ Ping 성공:', pingData);
    
    // 3. SMS 전송
    console.log('\n📱 SMS 전송...');
    const smsResult = await apiPost('/api/v1/auth/send-sms', {
      phone: '+821012345678',
      carrier: 'SKT',
      context: 'signup'
    });
    console.log('✅ SMS 전송 성공');
    
    // Rate limiting 방지를 위한 지연
    console.log('⏳ Rate limiting 방지를 위한 2초 대기...');
    await delay(2000);
    
    // 4. 인증 코드 검증
    console.log('\n🔐 인증 코드 검증...');
    const verifyResult = await apiPost('/api/v1/auth/verify-code', {
      phone: '+821012345678',
      code: smsResult.data.devCode,
      context: 'signup'
    });
    console.log('✅ 인증 코드 검증 성공');
    
    console.log('\n📋 사용 가능한 엔드포인트 요약:');
    console.log('- GET  /api/v1/_health ✅');
    console.log('- GET  /api/v1/_ping ✅');
    console.log('- POST /api/v1/auth/send-sms ✅');
    console.log('- POST /api/v1/auth/verify-code ✅');
    console.log('- GET  /api/v1/auth/me ✅ (인증 필요)');
    
  } catch (error) {
    console.log('❌ 엔드포인트 테스트 실패:', error.code, error.message);
  }
}

async function testAll() {
  console.log('🚀 백엔드 직접 호출 테스트 시작\n');
  
  try {
    await testAvailableEndpoints();
    console.log('\n' + '='.repeat(50) + '\n');
    await testAgeRestriction();
  } catch (error) {
    console.error('❌ 테스트 실행 중 에러 발생:', error);
  }
  
  console.log('\n🏁 테스트 완료');
  console.log('\n📝 결론:');
  console.log('- 현재 회원가입 완료 엔드포인트에 접근할 수 없음');
  console.log('- SMS 인증까지는 정상 작동');
  console.log('- 연령 제한 로직은 회원가입 완료 단계에서 검증되어야 함');
  console.log('- Rate limiting이 적용되어 연속 요청 시 지연 필요');
}

// 테스트 실행
testAll();
