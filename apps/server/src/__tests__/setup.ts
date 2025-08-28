// Jest 테스트 설정
import dotenv from 'dotenv';
import { closeRedis } from '../lib/redis';

// 환경 변수 로드
dotenv.config({ path: '.env.test' });

// 전역 테스트 설정
beforeAll(async () => {
  // 테스트 환경 설정
  process.env.NODE_ENV = 'test';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tango_test';
});

afterAll(async () => {
  // Redis 연결 정리
  await closeRedis();
  // 혹시 남아있는 타이머 정리
  jest.clearAllTimers();
});

// 테스트 타임아웃 설정
jest.setTimeout(30000);
