# 탱고 커뮤니티 MVP 구현 가이드

> **목적**: 로그인/회원가입 완료 상태에서 **피드/게시글/댓글/공감/팔로우/신고**까지 동작하는 최소 기능을 일관된 규약으로 구현

## 📋 구현 완료 항목

### ✅ 1단계: 데이터베이스 스키마
- [x] `posts` - 게시글 테이블
- [x] `post_images` - 게시글 이미지 테이블  
- [x] `comments` - 댓글 테이블
- [x] `post_likes` - 게시글 좋아요 테이블
- [x] `comment_likes` - 댓글 좋아요 테이블
- [x] `follows` - 팔로우 테이블
- [x] `blocks` - 차단 테이블
- [x] `reports` - 신고 테이블
- [x] `hashtags` - 해시태그 테이블
- [x] `post_hashtags` - 게시글-해시태그 연결 테이블
- [x] `uploads` - 업로드 메타데이터 테이블

### ✅ 2단계: 백엔드 API
- [x] **피드 API**: `/api/v1/feed` (커서 페이징)
- [x] **게시글 API**: 작성/조회/삭제/좋아요/신고
- [x] **댓글 API**: 작성/조회/삭제/좋아요
- [x] **팔로우 API**: 팔로우/언팔로우/팔로워/팔로잉 목록
- [x] **업로드 API**: 사전서명 URL 발급
- [x] **신고 API**: 게시글/댓글/사용자 신고

### ✅ 3단계: 핵심 기능
- [x] 커서 기반 페이징 (created_at + id 복합)
- [x] 멱등 좋아요 토글 (게시글/댓글)
- [x] 소프트 삭제 (deleted_at)
- [x] 차단된 사용자 콘텐츠 숨김
- [x] 해시태그 자동 생성/연결
- [x] 이미지 첨부 (최대 4장)
- [x] 대댓글 1단계 지원

## 🚀 빠른 시작

### 1. 마이그레이션 실행

```bash
cd apps/server
node scripts/apply_community_migrations.js
```

### 2. 서버 실행

```bash
npm run dev
# 또는
npm start
```

### 3. API 테스트

```bash
# 환경변수 설정 후
node scripts/test_community_api.js
```

## 📚 API 명세서

### 피드 조회
```http
GET /api/v1/feed?cursor=...&limit=20
Authorization: Bearer <token>
```

**응답 예시:**
```json
{
  "success": true,
  "code": "OK",
  "data": {
    "items": [
      {
        "id": "uuid",
        "author": { "id": "uuid", "nickname": "사용자", "avatarUrl": null },
        "content": "게시글 내용...",
        "images": [],
        "likeCount": 0,
        "commentCount": 0,
        "liked": false,
        "createdAt": "2025-01-XX..."
      }
    ],
    "nextCursor": "base64-encoded-cursor"
  }
}
```

### 게시글 작성
```http
POST /api/v1/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "게시글 내용",
  "attachmentKeys": ["uploads/2025/01/image.jpg"],
  "locationCode": "4113510900",
  "hashtags": ["태그1", "태그2"]
}
```

### 게시글 좋아요
```http
POST /api/v1/posts/{postId}/like
Authorization: Bearer <token>
```

### 댓글 작성
```http
POST /api/v1/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "post_id": "uuid",
  "content": "댓글 내용",
  "parent_comment_id": "uuid" // 선택사항
}
```

### 사용자 팔로우
```http
POST /api/v1/follow/{userId}
Authorization: Bearer <token>
```

### 업로드 사전서명
```http
POST /api/v1/upload/presign
Authorization: Bearer <token>
Content-Type: application/json

{
  "files": [
    {
      "name": "image.jpg",
      "mime": "image/jpeg",
      "size": 1048576
    }
  ]
}
```

## 🗄️ 데이터베이스 구조

### 핵심 테이블 관계
```
users (사용자)
├── posts (게시글)
│   ├── post_images (이미지)
│   ├── post_hashtags (해시태그)
│   └── comments (댓글)
│       └── comment_likes (댓글 좋아요)
├── post_likes (게시글 좋아요)
├── follows (팔로우)
├── blocks (차단)
├── reports (신고)
└── uploads (업로드)
```

### 주요 인덱스
- `idx_posts_created` - 피드 조회 최적화
- `idx_posts_user_created` - 사용자별 게시글 조회
- `idx_comments_post_created` - 댓글 목록 조회
- `idx_follows_followee` - 팔로워 목록 조회

## 🔧 설정 및 환경변수

### 필수 환경변수
```bash
# 데이터베이스
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=tango

# API 설정
API_BASE=/api/v1
NODE_ENV=development
```

### 선택 환경변수
```bash
# CORS 설정
CORS_ORIGIN=https://example.com
FRONT_ORIGINS=https://example.com,https://app.example.com

# 보안
FORCE_HTTPS=false
TRUST_PROXY=1
```

## 🧪 테스트

### 단위 테스트
```bash
npm test
```

### API 테스트
```bash
# 전체 테스트
node scripts/test_community_api.js

# 개별 테스트
node scripts/test_community_api.js --test=feed
```

### 데이터베이스 테스트
```bash
# 연결 테스트
node scripts/check_db.js

# 마이그레이션 롤백 테스트
node scripts/apply_community_migrations.js --rollback
```

## 📁 파일 구조

```
apps/server/
├── migrations/                    # 데이터베이스 마이그레이션
│   ├── 12_community_posts_up.sql
│   ├── 13_community_comments_up.sql
│   ├── 14_community_likes_up.sql
│   ├── 15_community_follows_up.sql
│   ├── 16_community_reports_up.sql
│   ├── 17_community_hashtags_up.sql
│   └── 18_community_uploads_up.sql
├── src/
│   ├── types/                    # TypeScript 타입 정의
│   │   └── community.ts
│   ├── repos/                    # 데이터 액세스 레이어
│   │   └── communityRepo.ts
│   └── routes/                   # API 라우터
│       └── community.ts
├── scripts/                      # 유틸리티 스크립트
│   ├── apply_community_migrations.js
│   └── test_community_api.js
└── COMMUNITY_MVP.md             # 이 문서
```

## 🚨 주의사항

### 보안 고려사항
1. **인증 필수**: 모든 커뮤니티 API는 `authJwt` 미들웨어 적용
2. **권한 검증**: 게시글/댓글 삭제는 작성자만 가능
3. **차단 처리**: 차단된 사용자의 콘텐츠는 자동 숨김
4. **입력 검증**: XSS 방지를 위한 콘텐츠 길이 제한

### 성능 고려사항
1. **커서 페이징**: 오프셋 페이징 대신 커서 기반 사용
2. **인덱스 최적화**: 조회 패턴에 맞는 복합 인덱스 설계
3. **카운터 보정**: 비동기 큐를 통한 카운터 정합성 보장 (향후 구현)
4. **캐싱**: Redis를 통한 핫 데이터 캐싱 (향후 구현)

### 확장성 고려사항
1. **미디어 처리**: S3 호환 스토리지 연동 준비
2. **알림 시스템**: 실시간 알림을 위한 웹소켓 준비
3. **검색 엔진**: Elasticsearch 연동을 위한 구조 설계
4. **추천 시스템**: 사용자 행동 기반 콘텐츠 추천 준비

## 🔄 향후 계획

### 2단계 기능 (다음 스프린트)
- [ ] 실시간 알림 (웹소켓)
- [ ] 콘텐츠 검색 (Elasticsearch)
- [ ] 사용자 멘션 (@username)
- [ ] 북마크/좋아요
- [ ] 콘텐츠 신고 처리 (관리자)

### 3단계 기능 (장기 계획)
- [ ] AI 기반 콘텐츠 모더레이션
- [ ] 개인화 추천 알고리즘
- [ ] 콘텐츠 통계 및 분석
- [ ] 멀티미디어 처리 (동영상, 음성)
- [ ] 지역 기반 콘텐츠 추천

## 📞 지원 및 문의

### 개발팀 연락처
- **백엔드 개발자**: [이메일]
- **프론트엔드 개발자**: [이메일]
- **DevOps 엔지니어**: [이메일]

### 문서 및 리소스
- [API 문서 (OpenAPI)](./openapi/)
- [데이터베이스 스키마](./migrations/)
- [보안 가이드](./SECURITY_CONFIG.md)
- [배포 가이드](./deploy/README.md)

---

**마지막 업데이트**: 2025-01-XX  
**버전**: MVP v1.0  
**상태**: ✅ 구현 완료









