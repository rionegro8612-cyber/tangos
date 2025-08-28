# Tango Web

This is a [Next.js](https://next.js.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

웹 클라이언트를 실행하기 전에 다음 환경변수를 설정하세요:

```bash
# 1. .env.local.example을 .env.local로 복사
cp .env.local.example .env.local

# 2. .env.local 파일에서 필요한 값들을 설정
# - API_BASE: 백엔드 서버 주소
# - API 키들: 위치 검색 등에 필요한 API 키
```

## Authentication Flow

인증 흐름이 백엔드 서버 직접 호출로 **완전히 통일**되었습니다:

- **Frontend → Backend**: 직접 호출 (`/api/v1/auth/*`)
- **Next.js API Routes**: 완전 삭제됨
- **Session Management**: 백엔드 표준 쿠키 체계 사용
- **JWT Token**: 백엔드에서 발급 및 검증

### 주요 변경사항

1. **이중화 완전 제거** ✅: Next.js 스텁 JWT 발급 로직 및 API 라우트 모두 삭제
2. **경로 통일** ✅: 모든 인증 요청이 백엔드로 직접 전달
3. **구조 단순화** ✅: 프론트엔드 → 백엔드 단일 경로
4. **세션/토큰 체계 통일** ✅: 백엔드 표준 응답 형식 및 JWT 체계 사용
5. **혼합 구조 완전 해결** ✅: 모든 프론트엔드 호출이 백엔드 직접 호출로 통일

### 백엔드와 통일된 부분들

✅ **응답 형식**: `StandardResponse<T>` 형식 통일  
✅ **JWT 토큰**: `signAccessToken()`, `verifyAccessToken()` 체계 통일  
✅ **API 엔드포인트**: 모든 인증 요청이 `/api/v1/auth/*`로 백엔드 직접 호출  
✅ **세션 관리**: 백엔드 표준 쿠키 체계 사용  
✅ **에러 처리**: 백엔드 표준 에러 코드 및 메시지 형식  
✅ **호출 경로 통일**: 모든 프론트엔드 파일에서 백엔드 직접 호출 사용

### 삭제된 파일들

✅ `src/app/api/v1/auth/verify-code/route.ts` - 삭제 완료  
✅ `src/app/api/v1/auth/send-sms/route.ts` - 삭제 완료  
✅ `src/app/api/v1/auth/logout/route.ts` - 삭제 완료  
✅ `src/app/api/v1/auth/test/route.ts` - 삭제 완료  
✅ `src/app/api/v1/auth/verify-code/me/route.ts` - 삭제 완료

## Standard API Endpoints

표준 엔드포인트 (외부 계약 고정):

- `POST /api/v1/auth/send-sms` - SMS 전송
- `POST /api/v1/auth/resend-sms` - SMS 재전송  
- `POST /api/v1/auth/verify-code` - OTP 검증 → `{ isNew: boolean }`
- `POST /api/v1/auth/signup` - 최종 1회 제출(약관 동의 시점)

## Port Configuration

- **Web Client**: 3000 (Next.js)
- **Backend Server**: 4100 (Express/TypeScript)
