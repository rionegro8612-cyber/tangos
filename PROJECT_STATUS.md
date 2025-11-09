# 📊 탱고 프로젝트 진행 현황 보고서

> **작성일**: 2025-01-XX  
> **프로젝트명**: Tango Community Platform  
> **목적**: 현재까지 완료된 기능 및 진행 상황 정리

---

## 📋 목차

1. [백엔드 완료 사항](#1-백엔드-완료-사항)
2. [프론트엔드 완료 사항](#2-프론트엔드-완료-사항)
3. [데이터베이스 스키마](#3-데이터베이스-스키마)
4. [인프라 및 DevOps](#4-인프라-및-devops)
5. [진행 중 / 미완료 항목](#5-진행-중--미완료-항목)

---

## 1. 백엔드 완료 사항

### ✅ 1.1 인증 시스템 (Authentication)

#### SMS 기반 인증
- ✅ **POST `/api/v1/auth/send-sms`** - SMS 인증번호 발송
  - E.164 형식 전화번호 검증
  - Redis 기반 OTP 저장 (TTL: 300초)
  - 재전송 쿨다운 처리 (60초)
  - 레이트 리밋 적용 (전화번호별 1일 5회, IP별 1일 10회)
  - 개발 환경 OTP 코드 노출 옵션

- ✅ **POST `/api/v1/auth/resend-sms`** - SMS 재전송
  - 쿨다운 검증
  - 멱등성 보장 (5분 TTL)

- ✅ **POST `/api/v1/auth/verify-code`** - OTP 검증
  - OTP 코드 검증
  - 신규/기존 사용자 구분 (`isNew` 필드)
  - 가입 티켓 발급 (신규 사용자, 30분 TTL)
  - 자동 로그인 처리 (기존 사용자)
  - JWT 토큰 발급 및 쿠키 설정

#### 회원가입 플로우
- ✅ **POST `/api/v1/auth/register/start`** - 회원가입 시작
  - 전화번호/통신사 수집
  - 회원가입 세션 생성 (Redis, 30분 TTL)

- ✅ **POST `/api/v1/auth/register/verify`** - 전화번호 인증
  - OTP 검증
  - 세션 상태 업데이트 (`phoneVerified`)
  - 가입 티켓 발급

- ✅ **POST `/api/v1/auth/register/submit`** - 최종 제출
  - 가입 티켓 검증
  - 약관 동의 검증
  - 나이 제한 검증 (KYC_MIN_AGE: 50세)
  - 사용자 생성 (트랜잭션)

- ✅ **POST `/api/v1/auth/signup`** - 최종 1회 제출 (약관 동의 시점)
  - 멱등성 보장

#### 로그인/로그아웃
- ✅ **POST `/api/v1/auth/logout`** - 로그아웃
  - Access 토큰 쿠키 제거

- ✅ **GET `/api/v1/auth/me`** - 현재 사용자 정보 조회
  - JWT 토큰 검증
  - 사용자 프로필 반환

#### 리프레시 토큰
- ✅ **POST `/api/v1/auth/refresh`** - 토큰 갱신
  - Refresh 토큰 기반 Access 토큰 재발급

### ✅ 1.2 커뮤니티 기능 (Community)

#### 게시글 관리
- ✅ **GET `/api/v1/community/feed`** - 피드 조회
  - 커서 기반 페이지네이션
  - 인증 선택적 (authOptional)
  - 작성자 정보 포함 (nickname, avatar_url)
  - 최대 50개 제한

- ✅ **POST `/api/v1/community/posts`** - 게시글 생성
  - 인증 필수 (authRequired)
  - 본문 길이 검증 (1~2000자)
  - 금칙어 검증 (기본 구현)
  - 위치 코드 지원 (선택적)
  - 작성자 자동 연결

- ✅ **GET `/api/v1/community/posts/:id`** - 게시글 상세 조회
  - 인증 선택적
  - 작성자 정보 포함

- ⚠️ **게시글 삭제** - 주석 처리됨 (구현 대기)
- ⚠️ **게시글 수정** - 미구현

#### 댓글 기능
- ⚠️ **댓글 작성/조회/삭제** - 주석 처리됨 (구현 대기)

#### 좋아요 기능
- ⚠️ **게시글/댓글 좋아요** - 주석 처리됨 (구현 대기)

#### 팔로우 기능
- ⚠️ **팔로우/언팔로우** - 주석 처리됨 (구현 대기)
- ⚠️ **팔로워/팔로잉 목록** - 주석 처리됨 (구현 대기)

#### 신고 기능
- ⚠️ **콘텐츠 신고** - 주석 처리됨 (구현 대기)

#### 해시태그
- ⚠️ **해시태그 생성/연결** - 주석 처리됨 (구현 대기)

#### 이미지 업로드
- ⚠️ **게시글 이미지 첨부** - 주석 처리됨 (구현 대기)

### ✅ 1.3 파일 업로드 (Upload)

- ✅ **POST `/api/v1/upload/presign`** - Presigned URL 생성
  - MinIO 연동
  - 이미지 파일 타입 검증 (jpg, jpeg, png, gif, webp)
  - 고유 파일명 생성 (UUID)
  - 7일 유효 Presigned URL

- ✅ **GET `/api/v1/upload/status/:objectName`** - 파일 상태 확인
  - 파일 존재 여부 확인
  - 공개 URL 반환

- ✅ **DELETE `/api/v1/upload/:objectName`** - 파일 삭제
  - 관리자용 엔드포인트

### ✅ 1.4 사용자 관리 (User & Profile)

- ✅ **GET `/api/v1/user/me`** - 현재 사용자 정보
  - 인증 필수
  - JWT 기반 사용자 정보 반환

- ⚠️ **GET `/api/v1/profile/test`** - 테스트 엔드포인트만 구현됨
- ⚠️ **프로필 수정** - 미구현
- ⚠️ **닉네임 변경** - 미구현
- ⚠️ **프로필 이미지 업로드** - 미구현

### ✅ 1.5 위치 검색 (Location)

- ✅ **GET `/api/v1/location/search`** - 위치 검색
- ✅ **POST `/api/v1/location/code`** - 위치 코드 조회

### ✅ 1.6 KYC (Know Your Customer)

- ✅ **POST `/api/v1/auth/kyc/pass`** - PASS KYC 인증
  - 50세 이상 제한 검증
  - 본인인증 처리

- ✅ **GET `/api/v1/auth/kyc/ping`** - KYC 서비스 상태 확인

### ✅ 1.7 모니터링 및 관측성

#### 헬스체크
- ✅ **GET `/health`** - 기본 헬스체크
- ✅ **GET `/api/v1/_health`** - 통합 상태 확인
  - 서버 상태
  - 메모리 사용량
  - 트레이싱 상태
  - 메트릭 상태

#### 메트릭
- ✅ **GET `/metrics`** - Prometheus 메트릭 엔드포인트
  - OTP 전송/검증 메트릭
  - 사용자 가입/로그인 메트릭
  - 레이트 리밋 초과 메트릭

#### 트레이싱
- ✅ **GET `/api/v1/_tracing`** - OpenTelemetry 트레이싱 상태
  - 분산 추적 활성화
  - OTLP HTTP 익스포터 연동

#### 로깅
- ✅ Pino 기반 구조화 로깅
- ✅ Loki 연동 준비
- ✅ 요청 ID 추적 (requestId)

### ✅ 1.8 보안 기능

#### 미들웨어
- ✅ **Helmet** - 보안 헤더 설정
- ✅ **CORS** - Cross-Origin Resource Sharing 설정
- ✅ **Rate Limiting** - 레이트 리밋 미들웨어
  - 전화번호별 제한
  - IP별 제한
  - 재전송 쿨다운

#### 인증/인가
- ✅ **JWT 기반 인증**
  - Access 토큰 (쿠키 저장)
  - Refresh 토큰 (쿠키 저장)
  - 토큰 검증 미들웨어 (authRequired, authOptional)

#### 멱등성
- ✅ **Idempotency Middleware** - 중복 요청 방지
  - OTP 발송에 적용
  - OTP 검증에 적용
  - 회원가입 제출에 적용

#### 에러 처리
- ✅ 표준 에러 응답 형식
- ✅ 에러 코드 매핑
- ✅ 요청 ID 포함

### ✅ 1.9 데이터베이스 연동

- ✅ PostgreSQL 연결 설정
- ✅ 트랜잭션 처리
- ✅ 쿼리 빌더 사용
- ✅ 마이그레이션 시스템

### ✅ 1.10 Redis 연동

- ✅ Redis 클라이언트 설정
- ✅ OTP 저장 (TTL 기반)
- ✅ 세션 관리
- ✅ 레이트 리밋 카운터
- ✅ 가입 티켓 저장

---

## 2. 프론트엔드 완료 사항

### ✅ 2.1 인증 페이지

#### 로그인
- ✅ **`/login`** - 로그인 페이지
  - 전화번호 입력 (한국 형식 자동 변환)
  - SMS 인증번호 전송
  - OTP 입력 및 검증
  - 개발 모드 OTP 코드 표시
  - 재전송 쿨다운 타이머
  - 자동 로그인 후 프로필 페이지로 이동

#### 회원가입
- ✅ **`/register/start`** - 회원가입 시작 페이지
- ✅ **`/register/phone`** - 전화번호 입력
- ✅ **`/register/carrier`** - 통신사 선택
- ✅ **`/register/verify`** - 인증번호 확인
- ✅ **`/register/info`** - 사용자 정보 입력
- ✅ 회원가입 플로우 전체 구현

### ✅ 2.2 온보딩

- ✅ **`/onboarding`** - 온보딩 시작
- ✅ **`/onboarding/nickname`** - 닉네임 설정
- ✅ **`/onboarding/region`** - 지역 선택

### ✅ 2.3 프로필

- ✅ **`/profile`** - 사용자 프로필 페이지
  - 사용자 정보 표시 (ID, 전화번호, 닉네임, 가입일)
  - 로그아웃 기능
  - `/auth/me` API 연동
  - 자동 리다이렉트 (로그인 필요 시)

### ✅ 2.4 공통 컴포넌트

- ✅ **`AuthGate`** - 인증 게이트 컴포넌트
- ✅ **`RequireAuth`** - 인증 필수 컴포넌트
- ✅ **`OtpForm`** - OTP 입력 폼
- ✅ **`NicknameInput`** - 닉네임 입력 컴포넌트
- ✅ **`LocationAutocomplete`** - 위치 자동완성
- ✅ **`LocationAutocompleteV2`** - 위치 자동완성 v2
- ✅ **`LogoutButton`** - 로그아웃 버튼

### ✅ 2.5 상태 관리

- ✅ **Zustand 기반 인증 상태 관리**
  - 사용자 정보 저장
  - 로그인 상태 관리

### ✅ 2.6 API 클라이언트

- ✅ **표준 API 클라이언트**
  - `/lib/api.ts` - API 호출 유틸리티
  - `/lib/http.ts` - HTTP 클라이언트
  - 표준 응답 형식 처리
  - 에러 처리

### ✅ 2.7 UI/UX

- ✅ Tailwind CSS 적용
- ✅ 반응형 디자인
- ✅ 로딩 상태 표시
- ✅ 에러 메시지 표시

---

## 3. 데이터베이스 스키마

### ✅ 3.1 인증 관련 테이블

- ✅ **`users`** - 사용자 테이블
  - 기본 사용자 정보 (id, phone, nickname 등)
  - 프로필 필드 (avatar_url, region 등)
  - 나이 컬럼 (age)

- ✅ **`auth_refresh_tokens`** - 리프레시 토큰 테이블
  - 토큰 해시 저장
  - 만료 시간 관리
  - 취소 처리

- ✅ **`auth_sms_codes`** - SMS 인증 코드 테이블
  - OTP 코드 저장 (해시)
  - 만료 시간 관리
  - 시도 횟수 추적

- ✅ **`signup_sessions`** - 회원가입 세션 테이블
  - 회원가입 진행 상태 관리

- ✅ **`terms_agreement_logs`** - 약관 동의 로그
  - 약관 동의 기록

### ✅ 3.2 커뮤니티 관련 테이블

- ✅ **`posts`** - 게시글 테이블
  - 기본 정보 (id, user_id, content, location_code)
  - 카운터 (like_count, comment_count, images_count)
  - 소프트 삭제 (deleted_at)
  - 인덱스 최적화

- ✅ **`post_images`** - 게시글 이미지 테이블
  - 이미지 URL 및 메타데이터
  - 정렬 순서 (ord)

- ✅ **`comments`** - 댓글 테이블
  - 기본 정보 (id, post_id, user_id, content)
  - 대댓글 지원 (parent_comment_id)
  - 좋아요 카운터
  - 소프트 삭제

- ✅ **`post_likes`** - 게시글 좋아요 테이블
- ✅ **`comment_likes`** - 댓글 좋아요 테이블
- ✅ **`follows`** - 팔로우 테이블
- ✅ **`blocks`** - 차단 테이블
- ✅ **`reports`** - 신고 테이블
- ✅ **`hashtags`** - 해시태그 테이블
- ✅ **`post_hashtags`** - 게시글-해시태그 연결 테이블
- ✅ **`uploads`** - 업로드 메타데이터 테이블

### ✅ 3.3 기타 테이블

- ✅ **`locations`** - 위치 정보 테이블
- ✅ **`nickname_blacklist`** - 닉네임 금지어 테이블
- ✅ **`device_block_list`** - 차단된 디바이스 목록

### ✅ 3.4 도메인 및 타입

- ✅ **`user_id_t`** - 사용자 ID 타입 도메인
  - UUID/BigInt/Integer 자동 감지
  - 호환성 보장

---

## 4. 인프라 및 DevOps

### ✅ 4.1 컨테이너화

- ✅ **Dockerfile** - 서버 컨테이너 정의
- ✅ **docker-compose.yml** - 로컬 개발 환경
- ✅ **docker-compose.staging.yml** - 스테이징 환경
- ✅ **docker-compose.prod.yml** - 프로덕션 환경

### ✅ 4.2 모니터링 스택

- ✅ **Prometheus** - 메트릭 수집
  - 설정 파일 (`prometheus.yml`)
  - 알림 규칙 (`prometheus-rules.yml`)

- ✅ **Grafana** - 시각화
  - 데이터소스 설정 (`grafana-datasources.yaml`)
  - Tempo 데이터소스 (`grafana-tempo-datasource.yaml`)

- ✅ **Loki** - 로그 수집
  - 설정 파일 (`loki-config.yaml`)

- ✅ **Promtail** - 로그 수집 에이전트
  - 설정 파일 (`promtail-config.yaml`)

- ✅ **Tempo** - 분산 추적
  - 설정 파일 (`tempo-config.yaml`)

- ✅ **Alertmanager** - 알림 관리
  - 설정 파일 (`alertmanager.yml`)

### ✅ 4.3 마이그레이션 관리

- ✅ **마이그레이션 스크립트**
  - `migrate-up.sh` / `Migrate-Up.ps1`
  - `migrate-down.sh` / `Migrate-Down.ps1`
  - `script/applyMigrations.js`

- ✅ **51개 마이그레이션 파일** 준비됨

### ✅ 4.4 배포 자동화

- ✅ **배포 스크립트** (`deploy/deploy.sh`)
- ✅ **배포 체크리스트** (`DEPLOYMENT_CHECKLIST.md`)
- ✅ **환경별 설정 파일** 준비

### ✅ 4.5 보안

- ✅ **보안 설정 문서** (`SECURITY_CONFIG.md`)
- ✅ **환경변수 관리** (`env.example`)
- ✅ **시크릿 관리** (`secrets/` 디렉토리)

---

## 5. 진행 중 / 미완료 항목

### ⚠️ 5.1 커뮤니티 기능 (구현 필요)

#### 게시글
- ⚠️ 게시글 삭제 API
- ⚠️ 게시글 수정 API
- ⚠️ 게시글 좋아요 토글 API
- ⚠️ 게시글 이미지 첨부 기능

#### 댓글
- ⚠️ 댓글 작성 API
- ⚠️ 댓글 조회 API
- ⚠️ 댓글 삭제 API
- ⚠️ 댓글 좋아요 토글 API

#### 팔로우
- ⚠️ 팔로우/언팔로우 API
- ⚠️ 팔로워 목록 조회
- ⚠️ 팔로잉 목록 조회

#### 기타
- ⚠️ 신고 API 구현
- ⚠️ 해시태그 자동 생성/연결
- ⚠️ 차단 기능 API
- ⚠️ 차단된 사용자 콘텐츠 필터링

### ⚠️ 5.2 사용자 프로필

- ⚠️ 프로필 수정 API
- ⚠️ 닉네임 변경 API
- ⚠️ 프로필 이미지 업로드/변경
- ⚠️ 프로필 조회 API (다른 사용자)

### ⚠️ 5.3 프론트엔드 커뮤니티

- ⚠️ 피드 페이지 구현
- ⚠️ 게시글 작성 페이지
- ⚠️ 게시글 상세 페이지
- ⚠️ 댓글 UI
- ⚠️ 좋아요 UI
- ⚠️ 이미지 업로드 UI

### ⚠️ 5.4 테스트

- ⚠️ 백엔드 단위 테스트
- ⚠️ 통합 테스트
- ⚠️ E2E 테스트
- ⚠️ API 테스트 스크립트

### ⚠️ 5.5 문서화

- ⚠️ API 문서 (OpenAPI/Swagger)
- ⚠️ 개발자 가이드
- ⚠️ 사용자 매뉴얼

### ⚠️ 5.6 성능 최적화

- ⚠️ Redis 캐싱 전략
- ⚠️ 데이터베이스 쿼리 최적화
- ⚠️ 이미지 리사이징
- ⚠️ CDN 연동

### ⚠️ 5.7 알림 시스템

- ⚠️ 실시간 알림 (웹소켓)
- ⚠️ 푸시 알림
- ⚠️ 이메일 알림

---

## 📊 전체 진행률

### 백엔드: **약 70%**
- 인증/회원가입: ✅ **100%**
- 커뮤니티 기본: ✅ **40%** (게시글 작성/조회만 완료)
- 파일 업로드: ✅ **100%**
- 모니터링: ✅ **100%**
- 보안: ✅ **90%**

### 프론트엔드: **약 50%**
- 인증/회원가입: ✅ **100%**
- 프로필: ✅ **60%** (조회만, 수정 미구현)
- 커뮤니티: ⚠️ **0%** (미구현)

### 데이터베이스: **약 95%**
- 스키마 설계: ✅ **100%**
- 마이그레이션: ✅ **100%**
- 인덱스 최적화: ✅ **80%**

### 인프라: **약 80%**
- 모니터링 스택: ✅ **100%**
- 배포 자동화: ✅ **70%**
- CI/CD: ⚠️ **미구현**

---

## 🎯 다음 우선순위

1. **커뮤니티 핵심 기능 완성**
   - 댓글 API 구현
   - 좋아요 API 구현
   - 피드 페이지 UI 구현

2. **프로필 기능 강화**
   - 프로필 수정 API
   - 프로필 이미지 업로드

3. **테스트 코드 작성**
   - 핵심 기능 단위 테스트
   - API 통합 테스트

4. **성능 최적화**
   - Redis 캐싱
   - 쿼리 최적화

---

**마지막 업데이트**: 2025-01-XX  
**작성자**: AI Assistant  
**문서 버전**: 1.0




