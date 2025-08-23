-- 기존 메모리 기반 OTP 시스템을 데이터베이스로 마이그레이션
-- 기존 API 호환성 유지하면서 데이터 영속성 확보

-- 1. auth_sms_codes 테이블 생성 (기존 otpStore.ts 대체)
CREATE TABLE IF NOT EXISTS auth_sms_codes (
    id SERIAL PRIMARY KEY,
    phone_e164_norm VARCHAR(20) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'login',
    try_count INTEGER DEFAULT 0,
    max_try INTEGER DEFAULT 3,
    expire_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP NULL
);

-- 2. 성능을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_phone ON auth_sms_codes(phone_e164_norm);
CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_expire ON auth_sms_codes(expire_at);
CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_purpose ON auth_sms_codes(purpose);
CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_created ON auth_sms_codes(created_at);

-- 3. 기존 데이터 마이그레이션 (필요시)
-- INSERT INTO auth_sms_codes (phone_e164_norm, code_hash, purpose, expire_at)
-- SELECT phone, code, 'login', NOW() + INTERVAL '5 minutes'
-- FROM 임시_otp_데이터;

-- 4. 테이블 권한 설정
GRANT ALL PRIVILEGES ON auth_sms_codes TO tango;
GRANT USAGE, SELECT ON SEQUENCE auth_sms_codes_id_seq TO tango;

-- 5. 테이블 생성 확인
SELECT 'auth_sms_codes 테이블 생성 완료' as status;
