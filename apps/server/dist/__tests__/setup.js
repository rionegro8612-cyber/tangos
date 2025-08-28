"use strict";
// Jest 테스트 환경 설정
process.env.NODE_ENV = 'test';
// 환경변수 설정 (테스트용)
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/tango_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-key';
process.env.PHONE_ENC_KEY = 'test-32-bytes-minimum-secret-key';
// 글로벌 테스트 설정
global.console = {
    ...console,
    // 테스트 중 console.log 숨기기
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
