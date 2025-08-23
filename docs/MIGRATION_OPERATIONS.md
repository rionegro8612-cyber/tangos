# 마이그레이션 운영 규칙

## 📋 개요

이 문서는 "스키마 추가 → 코드 배포 → 구필드 제거(2단계)" 마이그레이션 프로세스의 운영 규칙을 정의합니다.

## 🔄 2단계 마이그레이션 프로세스

### Stage 1: 스키마 추가 (코드 배포 전)
- 새로운 컬럼, 테이블, 인덱스 추가
- 기존 데이터에 영향을 주지 않는 변경사항
- 애플리케이션 코드가 아직 새로운 스키마를 사용하지 않음

### Stage 2: 구필드 제거 (코드 배포 후)
- 더 이상 사용하지 않는 컬럼, 테이블, 인덱스 제거
- 애플리케이션 코드가 새로운 스키마로 완전히 전환된 후 실행
- **주의**: 이 단계는 되돌릴 수 없음

## 🚀 CI/CD 파이프라인

### GitHub Actions 워크플로우
- **테스트**: 코드 품질 및 테스트 실행
- **빌드**: 애플리케이션 빌드 및 Docker 이미지 생성
- **배포**: 스테이징/프로덕션 환경 배포
- **마이그레이션**: 배포 직후 자동 마이그레이션 실행
- **헬스체크**: 에러율 5% 임계치 체크
- **롤백**: 임계치 초과 시 자동 롤백

### 배포 후 마이그레이션 실행
```yaml
- name: Run database migrations
  run: |
    export DB_HOST=${{ secrets.DB_HOST }}
    export DB_PORT=${{ secrets.DB_PORT }}
    export DB_NAME=${{ secrets.DB_NAME }}
    export DB_USER=${{ secrets.DB_USER }}
    export DB_PASSWORD=${{ secrets.DB_PASSWORD }}
    export DB_SSLMODE=${{ secrets.DB_SSLMODE }}
    
    chmod +x ./migrate-up.sh
    ./migrate-up.sh
```

## 🏥 헬스체크 및 롤백

### 에러율 임계치
- **롤백 기준**: 에러율 5% 이상
- **체크 간격**: 30초 (설정 가능)
- **최대 실패 횟수**: 3회

### 헬스체크 메트릭
- HTTP 상태 코드
- 에러율 계산
- CPU/메모리 사용률
- 응답 시간
- 데이터베이스 연결 상태

### 자동 롤백 트리거
```javascript
if (errorRate > 0.05) { // 5%
  console.error("🚨 Error rate exceeds threshold. Initiating rollback...");
  await this.triggerRollback();
}
```

## 🛠️ 마이그레이션 관리 도구

### Migration Manager
```bash
# Stage 1: 스키마 추가
node scripts/migration-manager.js stage1

# Stage 2: 구필드 제거 (코드 배포 후)
node scripts/migration-manager.js stage2

# 상태 확인
node scripts/migration-manager.js status

# 롤백
node scripts/migration-manager.js rollback before_schema_add
```

### Health Checker
```bash
# 지속적 모니터링 시작
node scripts/health-check.js start

# 단일 체크
node scripts/health-check.js check

# 상태 확인
node scripts/health-check.js status
```

## 📁 마이그레이션 파일 구조

### 파일명 규칙
```
01_extensions_up.sql      # Stage 1: 스키마 추가
01_extensions_down.sql    # 롤백용
02_triggers_up.sql       # Stage 1: 스키마 추가
02_triggers_down.sql     # 롤백용
...
```

### 단계별 분류
- **schema_add**: `add_*`, `create_*` 패턴
- **field_remove**: `remove_*`, `drop_*` 패턴
- **schema_modify**: 기타 수정사항

## 🔒 보안 및 권한

### 데이터베이스 접근
- 환경변수를 통한 데이터베이스 연결 정보 관리
- `.env` 파일은 Git에 커밋 금지
- 프로덕션 환경에서는 SSL 연결 필수

### 롤백 권한
- Stage 2 실행 전 관리자 승인 필요
- 구필드 제거는 되돌릴 수 없음
- 롤백 실행 시 로그 기록

## 📊 모니터링 및 알림

### 로그 기록
- 마이그레이션 실행 로그
- 헬스체크 결과
- 에러율 변화 추이
- 롤백 이벤트

### 알림 설정
- 에러율 임계치 초과 시 즉시 알림
- 마이그레이션 실패 시 알림
- 롤백 실행 시 알림

## 🚨 비상 대응

### 수동 롤백 절차
1. 애플리케이션 중지
2. 데이터베이스 백업
3. 마이그레이션 롤백 실행
4. 이전 버전으로 애플리케이션 롤백
5. 헬스체크 확인

### 복구 절차
1. 문제 원인 분석
2. 수정된 마이그레이션 스크립트 작성
3. 테스트 환경에서 검증
4. 프로덕션 환경 재배포

## 📝 체크리스트

### 배포 전
- [ ] 마이그레이션 스크립트 테스트
- [ ] 롤백 스크립트 검증
- [ ] 데이터베이스 백업
- [ ] 환경변수 설정 확인

### 배포 중
- [ ] Stage 1 마이그레이션 실행
- [ ] 코드 배포 완료 확인
- [ ] 헬스체크 통과 확인
- [ ] Stage 2 마이그레이션 실행

### 배포 후
- [ ] 헬스체크 지속적 모니터링
- [ ] 에러율 임계치 모니터링
- [ ] 성능 메트릭 확인
- [ ] 로그 모니터링

## 🔗 관련 문서

- [데이터베이스 스키마 설계 가이드](./DATABASE_SCHEMA.md)
- [CI/CD 파이프라인 설정](./CI_CD_SETUP.md)
- [헬스체크 엔드포인트 구현](./HEALTH_CHECK_ENDPOINTS.md)
- [롤백 전략 및 절차](./ROLLBACK_STRATEGY.md)
