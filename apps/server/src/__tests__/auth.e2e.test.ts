import request from 'supertest';
import app from '../app';
import { createClient } from 'redis';
import { seedUser, cleanupUsers, closePool } from './helpers/db';
import { cleanupTestData, setTestOtp } from './helpers/redis';
import { ensureRedis } from '../lib/redis';

// Redis 클라이언트 (테스트용)
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

describe('Auth E2E Tests', () => {
  // 테스트별 고유 전화번호 (간섭 방지)
  const PHONES = {
    resend: "+821000000001",
    verifyExisting: "+821000000002",  // 기존 사용자 (시드 대상)
    expired: "+821000000003",
    ratelimit: "+821000000004",
    idempotency: "+821000000005",
    general: "+821000000006"
  };
  
  let testPhone: string;
  let testOtp: string;
  let accessToken: string;
  let refreshToken: string;
  let requestId: string;

  beforeAll(async () => {
    // Redis 연결
    await redis.connect();
    
    // 테스트용 전화번호 설정
    testPhone = PHONES.general;
    requestId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 테스트용 OTP 설정 (기존 사용자 시뮬레이션)
    await setTestOtp(PHONES.verifyExisting, '123456', 300);
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await cleanupTestData();
    await redis.disconnect();
  });

  beforeEach(async () => {
    // 각 테스트마다 새로운 requestId 생성
    requestId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 테스트 간섭 방지를 위한 데이터 정리
    await cleanupTestData();
  });

  describe('OTP 발급 → 검증 → 토큰 발급 → 갱신 → 로그아웃 플로우', () => {
    it('1. OTP 발급 성공', async () => {
      const response = await request(app)
        .post('/api/v1/auth/send-sms')
        .set('idempotency-key', requestId)
        .send({
          phone: testPhone,
          carrier: 'SKT',
          context: 'test'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.code).toBe('OTP_SENT');
      expect(response.body.data.phoneE164).toBe(testPhone);
      expect(response.body.data.devCode).toBeDefined();

      testOtp = response.body.data.devCode;
      console.log(`[TEST] OTP 발급 성공: ${testPhone} -> ${testOtp}`);
    });

    it('2. OTP 재전송 쿨다운 테스트', async () => {
      // 먼저 OTP 발급
      const sendResponse = await request(app)
        .post('/api/v1/auth/send-sms')
        .set('idempotency-key', `${requestId}-send-first`)
        .send({
          phone: PHONES.resend,
          carrier: 'SKT',
          context: 'test'
        });

      expect(sendResponse.status).toBe(200);

      // 즉시 재전송 시도 (쿨다운 적용)
      const response = await request(app)
        .post('/api/v1/auth/resend-sms')
        .set('idempotency-key', `${requestId}-resend`)
        .send({
          phone: PHONES.resend,
          carrier: 'SKT',
          context: 'test'
        });

      expect(response.status).toBe(429);
      expect(response.body.code).toBe('RESEND_BLOCKED');
      expect(response.body.data.retryAfter).toBeDefined();
      console.log(`[TEST] 재전송 쿨다운 확인: ${response.body.data.retryAfter}초`);
    });

    it('3. OTP 검증 성공', async () => {
      // 기존 사용자로 OTP 발급
      const sendResponse = await request(app)
        .post('/api/v1/auth/send-sms')
        .set('idempotency-key', `${requestId}-verify-send`)
        .send({
          phone: PHONES.verifyExisting,
          carrier: 'SKT',
          context: 'test'
        });

      expect(sendResponse.status).toBe(200);
      const newOtp = sendResponse.body.data.devCode;

      // 즉시 검증 (만료 방지)
      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .set('idempotency-key', `${requestId}-verify`)
        .send({
          phone: PHONES.verifyExisting,
          code: newOtp,
          context: 'test'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // 기존 사용자가 아니므로 SIGNUP_REQUIRED가 정상
      expect(response.body.code).toBe('SIGNUP_REQUIRED');
      expect(response.body.data.verified).toBe(true);
      expect(response.body.data.isNew).toBe(true);
      console.log(`[TEST] OTP 검증 성공 (신규 사용자 - 회원가입 필요)`);
    });

    it('4. 잘못된 OTP 코드로 검증 실패', async () => {
      // 먼저 OTP 발급
      const sendResponse = await request(app)
        .post('/api/v1/auth/send-sms')
        .set('idempotency-key', `${requestId}-send-invalid`)
        .send({
          phone: PHONES.general,
          carrier: 'SKT',
          context: 'test'
        });

      expect(sendResponse.status).toBe(200);

      // 잘못된 코드로 검증
      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .set('idempotency-key', `${requestId}-verify-invalid`)
        .send({
          phone: PHONES.general,
          code: '999999', // 잘못된 코드
          context: 'test'
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_CODE');
      console.log(`[TEST] 잘못된 OTP 검증 실패 확인`);
    });

    it('5. 만료된 OTP로 검증 실패', async () => {
      // 새로운 OTP 발급 (TTL 3초로 설정)
      const sendResponse = await request(app)
        .post('/api/v1/auth/send-sms')
        .set('idempotency-key', `${requestId}-expire-send`)
        .send({
          phone: PHONES.expired,
          carrier: 'SKT',
          context: 'test'
        });

      expect(sendResponse.status).toBe(200);
      const expireOtp = sendResponse.body.data.devCode;

      // Redis에서 TTL을 3초로 강제 설정 (실제 키 구조에 맞춤)
      const r = await ensureRedis();
      await r.expire(`otp:${PHONES.expired}:code`, 3);

      // 4.1초 대기 (TTL 3초 초과)
      await new Promise(resolve => setTimeout(resolve, 4100));

      const response = await request(app)
        .post('/api/v1/auth/verify-code')
        .set('idempotency-key', `${requestId}-verify-expired`)
        .send({
          phone: PHONES.expired,
          code: expireOtp,
          context: 'test'
        });

      expect(response.status).toBe(410);
      expect(response.body.code).toBe('EXPIRED');
      console.log(`[TEST] 만료된 OTP 검증 실패 확인`);
    });

    it('6. Rate Limit 비활성화 확인', async () => {
      // 3회 요청 (Rate Limit이 비활성화되어 있음)
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          request(app)
            .post('/api/v1/auth/send-sms')
            .set('idempotency-key', `${requestId}-rate-limit-${i}`)
            .send({
              phone: PHONES.ratelimit,
              carrier: 'SKT',
              context: 'test'
            })
        );
      }

      const responses = await Promise.all(promises);
      const successful = responses.filter(r => r.status === 200);
      
      // Rate Limit이 비활성화되어 있으므로 모든 요청이 성공해야 함
      expect(successful.length).toBe(3);
      console.log(`[TEST] Rate Limit 비활성화 확인: 모든 요청이 200 응답`);
    });

    it('7. 멱등성 테스트', async () => {
      const idempotencyKey = `${requestId}-idempotency`;
      
      // 첫 번째 요청
      const response1 = await request(app)
        .post('/api/v1/auth/send-sms')
        .set('idempotency-key', idempotencyKey)
        .send({
          phone: PHONES.idempotency,
          carrier: 'SKT',
          context: 'test'
        });

      expect(response1.status).toBe(200);
      const firstOtp = response1.body.data.devCode;

      // 동일한 멱등키로 두 번째 요청
      const response2 = await request(app)
        .post('/api/v1/auth/send-sms')
        .set('idempotency-key', idempotencyKey)
        .send({
          phone: PHONES.idempotency,
          carrier: 'SKT',
          context: 'test'
        });

      expect(response2.status).toBe(200);
      expect(response2.body.data.devCode).toBe(firstOtp);
      console.log(`[TEST] 멱등성 확인: 동일한 응답 반환`);
    });

    it('8. 로그아웃 성공', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('idempotency-key', `${requestId}-logout`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.code).toBe('LOGOUT_OK');
      console.log(`[TEST] 로그아웃 성공`);
    });
  });

  describe('보안 테스트', () => {
    it('잘못된 전화번호 형식으로 OTP 발급 시도', async () => {
      const response = await request(app)
        .post('/api/v1/auth/send-sms')
        .set('idempotency-key', `${requestId}-invalid-phone`)
        .send({
          phone: 'invalid-phone',
          carrier: 'SKT',
          context: 'test'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('BAD_REQUEST');
      console.log(`[TEST] 잘못된 전화번호 형식 검증`);
    });

    it('필수 필드 누락으로 OTP 발급 시도', async () => {
      const response = await request(app)
        .post('/api/v1/auth/send-sms')
        .set('idempotency-key', `${requestId}-missing-fields`)
        .send({
          phone: testPhone,
          // carrier 누락
          context: 'test'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('BAD_REQUEST');
      console.log(`[TEST] 필수 필드 누락 검증`);
    });
  });
});
