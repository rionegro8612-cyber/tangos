// 닉네임 체크 API 테스트 스크립트
const baseUrl = process.env.API_BASE_URL || 'http://localhost:4100/api/v1';

async function testNicknameCheck() {
  console.log('🧪 닉네임 체크 API 테스트 시작...\n');

  // 테스트 케이스들
  const testCases = [
    { value: '테스트닉네임', userId: null, description: '신규 사용자 - 한글 닉네임' },
    { value: 'testnick123', userId: null, description: '신규 사용자 - 영문+숫자 닉네임' },
    { value: 'test_nick', userId: null, description: '신규 사용자 - 언더스코어 포함' },
    { value: 'a', userId: null, description: '신규 사용자 - 너무 짧은 닉네임 (1자)' },
    { value: 'testnickname123456789', userId: null, description: '신규 사용자 - 너무 긴 닉네임' },
    { value: '테스트', userId: null, description: '신규 사용자 - 정상 닉네임' },
  ];

  for (const testCase of testCases) {
    try {
      const url = testCase.userId 
        ? `${baseUrl}/profile/nickname/check?value=${encodeURIComponent(testCase.value)}&userId=${encodeURIComponent(testCase.userId)}`
        : `${baseUrl}/profile/nickname/check?value=${encodeURIComponent(testCase.value)}`;
      
      console.log(`📋 테스트: ${testCase.description}`);
      console.log(`   URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`   ✅ 성공: ${data.message || 'OK'}`);
        console.log(`   📊 데이터:`, JSON.stringify(data.data, null, 2));
      } else {
        console.log(`   ❌ 실패 (${response.status}): ${data.message || 'Unknown error'}`);
        console.log(`   📊 에러:`, JSON.stringify(data, null, 2));
      }
      console.log('');
    } catch (error) {
      console.log(`   ❌ 예외 발생:`, error.message);
      console.log('');
    }
  }

  console.log('✅ 테스트 완료!');
}

// 실행
testNicknameCheck().catch(console.error);




