# 환경 파일 설정 가이드

## 📁 필요한 환경 파일들

### 1. 백엔드 서버 환경 파일
**파일명**: `.env.staging.server` 또는 `.env.prod.server`

```bash
# 기본 설정
NODE_ENV=staging  # 또는 production
PORT=4100

# 데이터베이스
DATABASE_URL=postgres://tango:tango123@postgres:5432/tango_staging
POSTGRES_DB=tango_staging
POSTGRES_USER=tango
POSTGRES_PASSWORD=tango123

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_ACCESS_EXPIRES_MIN=30
JWT_REFRESH_EXPIRES_DAYS=7

# OTP 설정
OTP_TTL=300
OTP_RATE_PER_PHONE=5
OTP_RATE_PER_IP=20

# SMS 설정
SMS_PROVIDER=SENS
SMS_API_KEY=your-sms-api-key
SMS_SECRET_KEY=your-sms-secret-key

# 보안
PHONE_ENC_KEY=dev-32-bytes-minimum-secret-key
SESSION_SECRET=your-session-secret

# CORS
CORS_ORIGIN=http://localhost:3000
FRONT_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 2. 프론트엔드 환경 파일
**파일명**: `.env.staging.web` 또는 `.env.prod.web`

```bash
# API 설정
NEXT_PUBLIC_API_BASE=http://localhost:4100/api/v1
NEXT_PUBLIC_APP_NAME=Tango

# 환경
NODE_ENV=staging  # 또는 production

# 외부 서비스
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
NEXT_PUBLIC_KAKAO_MAPS_API_KEY=your-kakao-maps-api-key
```

## 🔧 환경별 설정 차이점

### 스테이징 환경
- `NODE_ENV=staging`
- 개발용 데이터베이스
- 테스트용 API 키
- 로컬 도메인

### 프로덕션 환경
- `NODE_ENV=production`
- 운영용 데이터베이스
- 실제 API 키
- 실제 도메인

## 📝 배포 시 주의사항

1. **민감 정보 보호**: `.env.*` 파일은 절대 Git에 커밋하지 마세요
2. **권한 설정**: 서버에서 `chmod 600`으로 보안 강화
3. **백업**: 환경 파일은 안전한 곳에 백업 보관
4. **검증**: 배포 전 환경 변수 값 검증 필수



































