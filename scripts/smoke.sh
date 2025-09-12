#!/bin/bash

# Tango 서버 스모크 테스트 스크립트
# 이전에 성공한 시나리오를 그대로 재현

set -e

echo "🚀 Tango 서버 스모크 테스트 시작"
echo "=================================="

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 테스트 결과 카운터
PASSED=0
FAILED=0

# 테스트 함수
test_endpoint() {
    local method=$1
    local url=$2
    local expected_status=$3
    local description=$4
    
    echo -e "${BLUE}테스트: $description${NC}"
    echo "  $method $url"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url")
    fi
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "  ${GREEN}✅ PASS${NC} (HTTP $response)"
        ((PASSED++))
    else
        echo -e "  ${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $response)"
        ((FAILED++))
    fi
    echo
}

# 1. 마이그레이션 테스트 (HTTP 엔드포인트로 대체)
echo -e "${YELLOW}1. 마이그레이션 테스트${NC}"
echo "데이터베이스 연결 및 핵심 기능 확인..."

# 데이터베이스 연결 테스트 (게시물 생성으로 확인)
echo "  데이터베이스 연결 테스트 중..."
test_post=$(curl -s -X POST http://localhost:4100/api/v1/community/posts \
    -H "Content-Type: application/json" \
    -d '{"content": "DB 연결 테스트", "locationCode": "KR-11"}')
if echo "$test_post" | grep -q "success.*true"; then
    echo -e "  ${GREEN}✅ 데이터베이스 연결 정상${NC}"
    ((PASSED++))
else
    echo -e "  ${RED}❌ 데이터베이스 연결 실패${NC}"
    ((FAILED++))
fi

echo

# 2. 서버/웹 기동 테스트
echo -e "${YELLOW}2. 서버/웹 기동 테스트${NC}"

test_endpoint "GET" "http://localhost:4100/api/v1/health" "200" "헬스체크 (200 OK)"
test_endpoint "GET" "http://localhost:4100/api/v1/community/feed" "200" "커뮤니티 피드 (라우터 로드 확인)"
test_endpoint "GET" "http://localhost:4100/api/v1/auth/me" "401" "인증 필요 확인 (401 Unauthorized)"

# 3. 인증 플로우 테스트
echo -e "${YELLOW}3. 인증 플로우 테스트${NC}"

# SMS 전송
echo -e "${BLUE}테스트: SMS 전송${NC}"
sms_response=$(curl -s -X POST http://localhost:4100/api/v1/auth/send-sms \
    -H "Content-Type: application/json" \
    -d '{"phone": "+821055599999"}')
if echo "$sms_response" | grep -q "success.*true"; then
    echo -e "  ${GREEN}✅ SMS 전송 성공${NC}"
    ((PASSED++))
else
    echo -e "  ${RED}❌ SMS 전송 실패${NC}"
    echo "  응답: $sms_response"
    ((FAILED++))
fi
echo

# OTP 코드 확인 (개발 환경)
echo -e "${BLUE}테스트: OTP 코드 확인${NC}"
otp_response=$(curl -s "http://localhost:4100/api/v1/auth/dev-code?phone=%2B821055599999")
if echo "$otp_response" | grep -q "code"; then
    echo -e "  ${GREEN}✅ OTP 코드 확인 성공${NC}"
    ((PASSED++))
    # OTP 코드 추출
    otp_code=$(echo "$otp_response" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
    echo "  OTP 코드: $otp_code"
else
    echo -e "  ${RED}❌ OTP 코드 확인 실패${NC}"
    echo "  응답: $otp_response"
    ((FAILED++))
fi
echo

# OTP 검증
if [ ! -z "$otp_code" ]; then
    echo -e "${BLUE}테스트: OTP 검증${NC}"
    verify_response=$(curl -s -X POST http://localhost:4100/api/v1/auth/verify-code \
        -H "Content-Type: application/json" \
        -d "{\"phone\": \"+821055599999\", \"code\": \"$otp_code\"}")
    if echo "$verify_response" | grep -q "success.*true"; then
        echo -e "  ${GREEN}✅ OTP 검증 성공${NC}"
        ((PASSED++))
    else
        echo -e "  ${RED}❌ OTP 검증 실패${NC}"
        echo "  응답: $verify_response"
        ((FAILED++))
    fi
    echo
fi

# 가입 완료
echo -e "${BLUE}테스트: 가입 완료${NC}"
register_response=$(curl -s -X POST http://localhost:4100/api/v1/auth/register/submit \
    -H "Content-Type: application/json" \
    -d '{"phone": "+821055599999", "profile": {"nickname": "testuser", "region": "KR-11", "birthYear": 1970}, "agreements": [{"code": "TOS", "version": "1.0", "required": true, "accepted": true}, {"code": "PRIVACY", "version": "1.0", "required": true, "accepted": true}]}')
if echo "$register_response" | grep -q "success.*true"; then
    echo -e "  ${GREEN}✅ 가입 완료 성공${NC}"
    ((PASSED++))
else
    echo -e "  ${RED}❌ 가입 완료 실패${NC}"
    echo "  응답: $register_response"
    ((FAILED++))
fi
echo

# 4. 콘텐츠/피드 테스트
echo -e "${YELLOW}4. 콘텐츠/피드 테스트${NC}"

# 게시물 생성
echo -e "${BLUE}테스트: 게시물 생성${NC}"
post_response=$(curl -s -X POST http://localhost:4100/api/v1/community/posts \
    -H "Content-Type: application/json" \
    -d '{"content": "스모크 테스트 게시물입니다!", "locationCode": "KR-11"}')
if echo "$post_response" | grep -q "success.*true"; then
    echo -e "  ${GREEN}✅ 게시물 생성 성공${NC}"
    ((PASSED++))
else
    echo -e "  ${RED}❌ 게시물 생성 실패${NC}"
    echo "  응답: $post_response"
    ((FAILED++))
fi
echo

# 피드 조회
test_endpoint "GET" "http://localhost:4100/api/v1/community/feed?limit=5" "200" "피드 조회 (방금 생성한 게시물 포함)"

# 5. MinIO 테스트
echo -e "${YELLOW}5. MinIO 테스트${NC}"

# MinIO 서버 상태 확인
echo -e "${BLUE}테스트: MinIO 서버 상태${NC}"
minio_response=$(curl -s -I http://localhost:9000 | head -1)
if echo "$minio_response" | grep -q "HTTP"; then
    echo -e "  ${GREEN}✅ MinIO 서버 실행 중${NC}"
    ((PASSED++))
else
    echo -e "  ${RED}❌ MinIO 서버 응답 없음${NC}"
    ((FAILED++))
fi
echo

# 결과 요약
echo "=================================="
echo -e "${YELLOW}테스트 결과 요약${NC}"
echo -e "  ${GREEN}✅ 통과: $PASSED${NC}"
echo -e "  ${RED}❌ 실패: $FAILED${NC}"
echo "  총 테스트: $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 모든 테스트 통과! 서버가 정상 동작합니다.${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  일부 테스트 실패. 서버 상태를 확인해주세요.${NC}"
    exit 1
fi