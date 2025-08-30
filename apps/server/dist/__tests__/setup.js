"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Jest 테스트 설정
const dotenv_1 = __importDefault(require("dotenv"));
const redis_1 = require("../lib/redis");
// 환경 변수 로드
dotenv_1.default.config({ path: '.env.test' });
// 전역 테스트 설정
beforeAll(async () => {
    // 테스트 환경 설정
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tango_test';
});
afterAll(async () => {
    // Redis 연결 정리
    await (0, redis_1.closeRedis)();
    // 혹시 남아있는 타이머 정리
    jest.clearAllTimers();
});
// 테스트 타임아웃 설정
jest.setTimeout(30000);
