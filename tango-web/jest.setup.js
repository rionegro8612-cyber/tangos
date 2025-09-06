// Next.js Jest 설정
import '@testing-library/jest-dom';

// 환경변수 설정 (테스트용)
process.env.NEXT_PUBLIC_API_BASE = 'http://localhost:4100/api/v1';

// 글로벌 모킹
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// fetch 모킹
global.fetch = jest.fn();


















