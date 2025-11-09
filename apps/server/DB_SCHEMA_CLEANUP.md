# DB 스키마 혼재 문제 정리 완료

## 📅 정리 일시
2025-08-30

## 🔍 문제 상황
- `migrations/` (Postgres)와 `sql/sql/` (과거 MySQL 스타일) 폴더 공존
- 실제 운영에서는 `migrations/` 폴더만 사용
- `sql/sql/` 폴더는 전혀 실행되지 않아 혼동만 야기

## ✅ 정리 내용

### 1. 백업 생성
- `sql/sql/` → `sql/sql_backup_20250830/`로 백업
- 향후 참조 필요 시 복원 가능

### 2. 혼재 폴더 삭제
- `sql/sql/` 폴더 완전 삭제
- DB 스키마 혼재 문제 해결

### 3. .gitignore 추가
- `sql/sql/` 및 `sql/sql_backup_*/` 추적 방지
- 향후 혼재 재발 방지

## 🚀 정리 후 상태

### 현재 사용 중인 스키마
```
migrations/                    ← ✅ 실제 사용 (Postgres)
├── 01_extensions_up.sql
├── 02_triggers_up.sql
├── 03_users_up.sql
├── 04_auth_sms_codes_up.sql
├── 05_terms_agreement_logs_up.sql
├── 06_locations_up.sql
├── 07_device_block_list_up.sql
├── 08_signups_delegated_up.sql
└── 09_nickname_blacklist_up.sql
```

### 정리된 폴더
```
sql/                          ← ✅ 정리 완료
├── sql_backup_20250830/      ← 백업 보관
├── 001_init.pg.sql           ← Postgres 초기화
└── 002_token_version.pg.sql  ← 토큰 버전 관리
```

## 🎯 정리 효과

### 1. 혼동 제거
- ✅ DB 스키마 폴더 구조 명확화
- ✅ 개발자 혼동 방지
- ✅ 마이그레이션 경로 단일화

### 2. 기능 영향 없음
- ✅ 모든 완성된 기능 정상 동작
- ✅ 실제 사용 중인 `migrations/` 폴더 유지
- ✅ 데이터베이스 스키마 변경 없음

### 3. 향후 관리 개선
- ✅ 단일 마이그레이션 경로로 관리 용이
- ✅ .gitignore로 혼재 재발 방지
- ✅ 백업으로 안전성 확보

## 📋 다음 단계 권장사항

1. **제재 테이블 활용**: `nickname_blacklist`, `device_block_list` 테이블을 OTP 남용 방어에 활용
2. **스키마 문서화**: `migrations/` 폴더의 스키마 변경 이력 정리
3. **정기 정리**: 향후 불필요한 스키마 파일 정기 점검

## 🔒 보안 고려사항

- 백업 폴더는 개발 환경에서만 접근 가능하도록 설정
- 프로덕션 환경에서는 백업 폴더 접근 제한
- 민감한 스키마 정보가 포함된 경우 적절한 권한 설정























