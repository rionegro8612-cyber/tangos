import request from 'supertest';
import app from '../app';
import { setTestOtp, cleanupTestData } from './helpers/redis';

describe('쿠키 세팅 테스트', () => {
  const testPhone = '+821000000001';
  const testCode = '123456';

  beforeAll(async () => {
    // 테스트용 OTP 설정
    await setTestOtp(testPhone, testCode);
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await cleanupTestData();
  });

  test('verify-code 성공 시 신규 사용자 가입 티켓이 발급되어야 함', async () => {
    const response = await request(app)
      .post('/api/v1/auth/verify-code')
      .send({
        phone: testPhone,
        code: testCode,
        context: 'test'
      })
      .expect(200);

    // 응답 본문 확인
    expect(response.body.success).toBe(true);
    expect(response.body.data.verified).toBe(true);
    expect(response.body.data.isNew).toBe(true);
    expect(response.body.data.registrationTicket).toBeDefined();
    expect(response.body.data.registrationTicket.expiresIn).toBe(1800); // 30분

    console.log('✅ 신규 사용자 가입 티켓 발급 확인:', {
      verified: response.body.data.verified,
      isNew: response.body.data.isNew,
      registrationTicket: response.body.data.registrationTicket
    });
  });

  test('verify-code 성공 시 응답 메시지가 올바르게 설정되어야 함', async () => {
    // 두 번째 테스트를 위해 새로운 OTP 설정
    await setTestOtp(testPhone, testCode);
    
    const response = await request(app)
      .post('/api/v1/auth/verify-code')
      .send({
        phone: testPhone,
        code: testCode,
        context: 'test'
      })
      .expect(200);

    // 응답 메시지 확인
    expect(response.body.message).toBe('SIGNUP_REQUIRED');
    expect(response.body.code).toBe('SIGNUP_REQUIRED');
    
    console.log('✅ 응답 메시지 확인:', {
      message: response.body.message,
      code: response.body.code
    });
  });
});
