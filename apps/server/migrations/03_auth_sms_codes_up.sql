-- OTP 코드 테이블 생성
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

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_phone_expire 
ON auth_sms_codes(phone_e164_norm, expire_at);

CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_purpose 
ON auth_sms_codes(purpose);

-- 코멘트 추가
COMMENT ON TABLE auth_sms_codes IS 'SMS OTP 코드 저장 테이블';
COMMENT ON COLUMN auth_sms_codes.phone_e164_norm IS 'E.164 형식 전화번호';
COMMENT ON COLUMN auth_sms_codes.code_hash IS '해시된 OTP 코드';
COMMENT ON COLUMN auth_sms_codes.purpose IS 'OTP 용도 (login, register 등)';
COMMENT ON COLUMN auth_sms_codes.try_count IS '시도 횟수';
COMMENT ON COLUMN auth_sms_codes.max_try IS '최대 시도 횟수';
COMMENT ON COLUMN auth_sms_codes.expire_at IS '만료 시간';
COMMENT ON COLUMN auth_sms_codes.used_at IS '사용된 시간';
