module.exports = {
  testEnvironment: "node",
  // ★ 테스트 파일만 매칭
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  // ★ 헬퍼 디렉터리들은 테스트 수집에서 제외
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/src/__tests__/helpers/'   // <- 여기 중요
  ],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/index.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  
  // TypeScript 지원
  preset: "ts-jest",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  
  // 모듈 해석
  moduleFileExtensions: ["ts", "js", "json"],
  
  // 환경 변수 설정 - setup.ts는 테스트가 아니라 "설정 파일"로 실행
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/helpers/setup.ts"],
  
  // 테스트 타임아웃
  testTimeout: 30000,
  
  // 비동기 테스트 대기
  testEnvironmentOptions: {
    url: "http://localhost"
  }
};
