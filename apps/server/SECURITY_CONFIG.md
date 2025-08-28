# 🔒 보안 설정 가이드

## 환경별 설정

### 개발 환경 (.env)

```bash
NODE_ENV=development
COOKIE_SECURE=false          # HTTP 허용
COOKIE_SAMESITE=Lax         # HTTP에서 안전
COOKIE_DOMAIN=              # 비워둠
FRONT_ORIGINS=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

### 스테이징 환경 (.env.staging)

```bash
NODE_ENV=production
COOKIE_SECURE=true          # HTTPS만 허용
COOKIE_SAMESITE=None       # 크로스사이트 지원
COOKIE_DOMAIN=.staging.yourdomain.com
FRONT_ORIGINS=https://staging.yourdomain.com
CORS_ORIGIN=https://staging.yourdomain.com
FORCE_HTTPS=true           # HTTPS 강제
```

### 프로덕션 환경 (.env.prod)

```bash
NODE_ENV=production
COOKIE_SECURE=true          # HTTPS만 허용
COOKIE_SAMESITE=None       # 크로스사이트 지원
COOKIE_DOMAIN=.yourdomain.com
FRONT_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
FORCE_HTTPS=true           # HTTPS 강제
```

## 보안 헤더

### Helmet.js 설정

- **CSP**: Content Security Policy 활성화
- **HSTS**: Strict-Transport-Security (1년, 서브도메인 포함)
- **X-Content-Type-Options**: nosniff
- **X-Frame-Options**: DENY
- **Referrer-Policy**: strict-origin-when-cross-origin

### CORS 설정

- **Origin**: 환경별 허용 목록
- **Credentials**: true (쿠키 전송 허용)
- **Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS

## 쿠키 보안

### 개발 환경

- `Secure=false`: HTTP 허용
- `SameSite=Lax`: CSRF 방지 + 호환성
- `HttpOnly=true`: XSS 방지

### 프로덕션 환경

- `Secure=true`: HTTPS만 허용
- `SameSite=None`: 크로스사이트 지원
- `HttpOnly=true`: XSS 방지
- `Domain`: 서브도메인 공유

## 테스트 방법

### 개발 환경 테스트

```bash
npm run test:security
```

### 프로덕션 환경 테스트

```bash
npm run test:security:prod
```

### 수동 테스트

1. **CORS**: 브라우저 개발자 도구에서 Origin 헤더 확인
2. **쿠키**: Set-Cookie 헤더의 옵션 확인
3. **보안 헤더**: Response Headers에서 보안 헤더 확인
4. **HTTPS 리다이렉트**: HTTP 요청 시 HTTPS로 리다이렉트 확인

## 주의사항

### SameSite=None 사용 시

- `Secure=true` 필수 (HTTPS만)
- 프로덕션에서만 사용
- 크로스사이트 요청에서 쿠키 전송 가능

### 도메인 설정

- `.yourdomain.com` 형태로 설정 (서브도메인 포함)
- 개발 환경에서는 비워둠
- 프로덕션에서만 설정

### 환경 전환 시

1. 환경변수 파일 변경
2. 서버 재시작
3. 보안 테스트 실행
4. 쿠키 동작 확인
