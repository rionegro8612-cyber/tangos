import request from 'supertest';
import app from '../app';

describe('Refresh Router 테스트', () => {
  test('POST /api/v1/auth/refresh 엔드포인트가 존재해야 함', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .expect(401); // 리프레시 토큰이 없으므로 401 응답

    // 응답 메시지 확인
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('AUTH_NO_RT');
    expect(response.body.message).toBe('리프레시 토큰이 없습니다.');

    console.log('✅ Refresh 엔드포인트 존재 확인:', {
      status: response.status,
      code: response.body.code,
      message: response.body.message
    });
  });

  test('리프레시 토큰이 있을 때 적절한 응답을 반환해야 함', async () => {
    // 유효하지 않은 리프레시 토큰으로 요청
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refresh_token=invalid_token')
      .expect(401);

    // 응답 메시지 확인
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('AUTH_RT_REUSE');
    expect(response.body.message).toBe('세션 재인증이 필요합니다.');

    console.log('✅ 리프레시 토큰 처리 확인:', {
      status: response.status,
      code: response.body.code,
      message: response.body.message
    });
  });
});











