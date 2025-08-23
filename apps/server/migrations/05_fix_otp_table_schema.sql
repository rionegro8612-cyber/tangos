-- 기존 OTP 코드와 완벽하게 호환되는 테이블 스키마
-- 기존 기능이 깨지지 않도록 정확한 구조로 생성

-- 1. 기존 잘못된 테이블 삭제 (있다면)
DROP TABLE IF EXISTS auth_sms_codes CASCADE;

-- 2. 올바른 테이블 생성 (기존 코드와 완벽 호환)
CREATE TABLE auth_sms_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    phone_e164_norm VARCHAR(20) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,                    -- "hash:salt" 형태
    expire_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    attempt_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 성능을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_phone ON auth_sms_codes(phone_e164_norm);
CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_expire ON auth_sms_codes(expire_at);
CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_created ON auth_sms_codes(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_request ON auth_sms_codes(request_id);

-- 4. 테이블 권한 설정
GRANT ALL PRIVILEGES ON auth_sms_codes TO tango;

-- 5. 테이블 생성 확인
SELECT 'auth_sms_codes 테이블 생성 완료 (기존 코드와 완벽 호환)' as status;
