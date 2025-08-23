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

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSLMODE`
- `APP_URL`

## 📊 모니터링

### 헬스체크 메트릭

- HTTP 상태 코드
- 에러율 (롤백 기준: 5%)
- CPU/메모리 사용률
- 응답 시간
- 데이터베이스 연결 상태

### 자동 롤백

에러율이 5%를 초과하면 자동으로 롤백이 실행됩니다:

1. 마이그레이션 롤백
2. 이전 버전으로 애플리케이션 롤백
3. 알림 발송

## 📚 문서

- [마이그레이션 운영 규칙](./docs/MIGRATION_OPERATIONS.md)
- [CI/CD 파이프라인 설정](./docs/CI_CD_SETUP.md)
- [헬스체크 엔드포인트 구현](./docs/HEALTH_CHECK_ENDPOINTS.md)

## 🚨 주의사항

- **Stage 2 실행 전 반드시 코드 배포 완료 확인**
- **구필드 제거는 되돌릴 수 없음**
- **프로덕션 환경에서는 SSL 연결 필수**
- **롤백 실행 시 데이터 손실 가능성 있음**

## 🤝 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

This project is licensed under the ISC License.
