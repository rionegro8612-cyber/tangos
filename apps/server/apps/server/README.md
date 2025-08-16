# Server

Express.js 기반의 서버 애플리케이션입니다.

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



