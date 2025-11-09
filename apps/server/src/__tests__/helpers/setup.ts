// 테스트 환경 설정 파일
import { stopMetrics } from '../../lib/metrics';
import { closeRedis } from '../../lib/redis';

// 모든 테스트 완료 후 정리
afterAll(async () => {
  await stopMetrics();
  await closeRedis();
  jest.clearAllTimers();
});

// 각 테스트 전 정리
beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

























