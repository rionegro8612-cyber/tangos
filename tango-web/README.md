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
# .env.local 파일 생성
NEXT_PUBLIC_API_BASE=http://localhost:4100/api/v1
```

## Standard API Endpoints

표준 엔드포인트 (외부 계약 고정):

- `POST /api/v1/auth/send-sms` - SMS 전송
- `POST /api/v1/auth/resend-sms` - SMS 재전송  
- `POST /api/v1/auth/verify-code` - OTP 검증 → `{ isNew: boolean }`
- `POST /api/v1/auth/signup` - 최종 1회 제출(약관 동의 시점)

## Port Configuration

- **Web Client**: 3000 (Next.js)
- **Backend Server**: 4100 (Express/TypeScript)
