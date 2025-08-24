# Tango Server

Express + TypeScript 기반 백엔드 서버

## Standard API Endpoints

표준 엔드포인트 (외부 계약 고정):

- `POST /api/v1/auth/send-sms` - SMS 전송
- `POST /api/v1/auth/resend-sms` - SMS 재전송  
- `POST /api/v1/auth/verify-code` - OTP 검증 → `{ isNew: boolean }`
- `POST /api/v1/auth/signup` - 최종 1회 제출(약관 동의 시점)

## OTP Policy

- **TTL**: 300초 (5분)
- **재전송 쿨다운**: 60초 (1분)
- **레이트 리밋**: 
  - 전화번호별: 1일 5회
  - IP별: 1일 10회
  - 재전송: 1분 3회

## Port Configuration

- **Server**: 4100 (Express/TypeScript)
- **Web Client**: 3000 (Next.js)

## Environment Variables

주요 환경변수:

```bash
PORT=4100
OTP_CODE_TTL_SEC=300          # OTP 코드 유효시간 (초)
OTP_RESEND_COOLDOWN_SEC=60    # 재전송 쿨다운 (초)
OTP_MAX_ATTEMPTS=3            # 최대 시도 횟수
OTP_RATE_PER_PHONE=5          # 전화번호별 1일 제한
OTP_RATE_PER_IP=10            # IP별 1일 제한
```

## 설치

```bash
npm install
```

## 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# 서버 설정
PORT=3001
NODE_ENV=development

# 데이터베이스
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# JWT
JWT_SECRET=your-secret-key-here

# OTP 설정
OTP_CODE_TTL_SEC=180
OTP_RESEND_COOLDOWN_SEC=60
OTP_MAX_ATTEMPTS=5
OTP_LOCK_MINUTES=10
```

## 실행

### 개발 모드
```bash
npm run dev
```

### 빌드
```bash
npm run build
```

### 프로덕션 실행
```bash
npm start
```

## API 엔드포인트

### 인증
- `POST /api/v1/auth/send-sms` - SMS 인증번호 발송
- `POST /api/v1/auth/verify-code` - SMS 인증번호 검증

### 헬스체크
- `GET /health` - 서버 상태 확인

## 프로젝트 구조

```
src/
├── auth/
│   └── sms/
│       ├── utils.ts      # SMS 유틸리티 함수
│       ├── service.ts    # SMS 서비스 로직
│       └── repo.ts       # SMS 데이터 접근
├── routes/
│   └── auth.ts          # 인증 라우터
├── db.ts                # 데이터베이스 연결
├── otpStore.ts          # OTP 저장소
└── index.ts             # 서버 진입점
```



