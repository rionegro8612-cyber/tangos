# Tango Project

마이그레이션 운영 규칙이 적용된 프로젝트입니다.

## 🚀 마이그레이션 운영 규칙

### 2단계 마이그레이션 프로세스

1. **Stage 1: 스키마 추가** (코드 배포 전)
   - 새로운 컬럼, 테이블, 인덱스 추가
   - 기존 데이터에 영향 없음

2. **Stage 2: 구필드 제거** (코드 배포 후)
   - 더 이상 사용하지 않는 필드 제거
   - 애플리케이션이 새 스키마로 완전 전환 후 실행

### CI/CD 파이프라인

- GitHub Actions를 통한 자동화된 배포
- 배포 직후 마이그레이션 실행
- 에러율 5% 임계치 체크
- 임계치 초과 시 자동 롤백

## 🛠️ 사용법

### 마이그레이션 관리

```bash
# Stage 1: 스키마 추가
npm run migrate:stage1

# Stage 2: 구필드 제거 (코드 배포 후)
npm run migrate:stage2

# 상태 확인
npm run migrate:status

# 롤백
npm run migrate:rollback
```

### 헬스체크 모니터링

```bash
# 지속적 모니터링 시작
npm run health:start

# 단일 체크
npm run health:check

# 상태 확인
npm run health:status
```

### 기존 마이그레이션

```bash
# 모든 마이그레이션 실행
npm run migrate:up

# 모든 마이그레이션 롤백
npm run migrate:down
```

## 📁 프로젝트 구조

```
├── .github/workflows/          # CI/CD 파이프라인
├── scripts/                    # 마이그레이션 관리 도구
│   ├── migration-manager.js    # 2단계 마이그레이션 관리
│   └── health-check.js        # 헬스체크 및 모니터링
├── migrations/                 # 데이터베이스 마이그레이션
├── docs/                       # 문서
│   └── MIGRATION_OPERATIONS.md # 마이그레이션 운영 규칙
├── migrate-up.sh              # 기존 마이그레이션 스크립트
└── migrate-down.sh            # 기존 롤백 스크립트
```

## 🔧 환경 설정

### 필수 환경변수

```bash
# 데이터베이스 연결
DATABASE_URL=postgres://user:pass@host:port/db
# 또는
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tango
DB_USER=postgres
DB_PASSWORD=password
DB_SSLMODE=disable

# 애플리케이션 URL (헬스체크용)
APP_URL=http://localhost:3000
```

### GitHub Secrets 설정

CI/CD 파이프라인을 위해 다음 secrets를 설정하세요:

## 🚀 CI/CD 환경 설정 완료

이 프로젝트는 GitHub Actions를 통한 자동화된 CI/CD 파이프라인이 구축되어 있습니다.

### CI 체크 목록

- **통합 CI 검증**: TypeScript 타입 체크, ESLint 린팅, Jest 테스트, Next.js 빌드, Prettier 포맷 체크

### 워크플로우

- **PR CI**: Pull Request 시 자동 검증
- **Main CI**: main 브랜치 푸시 시 자동 검증

### 개발 도구

- **TypeScript**: 엄격한 타입 체크
- **ESLint**: 코드 품질 관리
- **Prettier**: 코드 포맷팅
- **Jest**: 단위 테스트

### 모노레포 구조

- **apps/server**: Express.js 백엔드 서버
- **tango-web**: Next.js 프론트엔드 애플리케이션
