-- =====================================================
-- 스키마 스냅샷 (2025-08-20)
-- 재현 가능한 현재 상태
-- =====================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Functions
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users 테이블
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_e164_norm VARCHAR(20) NOT NULL UNIQUE,
    phone_enc BYTEA NOT NULL,
    nickname VARCHAR(30) NOT NULL UNIQUE,
    avatar_url TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    kyc_provider TEXT,
    kyc_verified BOOLEAN NOT NULL DEFAULT FALSE,
    kyc_checked_at TIMESTAMPTZ,
    birth_date DATE,
    age SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone ON users(phone_e164_norm);
CREATE INDEX IF NOT EXISTS ix_users_created_at ON users(created_at);

-- Users 트리거
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Signup Sessions 테이블
CREATE TABLE IF NOT EXISTS signup_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_e164_norm VARCHAR(20) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    carrier VARCHAR(50) NOT NULL,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Signup Sessions 인덱스
CREATE INDEX IF NOT EXISTS ix_signup_sessions_phone ON signup_sessions(phone_e164_norm);
CREATE INDEX IF NOT EXISTS ix_signup_sessions_expires ON signup_sessions(expires_at);

-- Signup Sessions 트리거
DROP TRIGGER IF EXISTS trg_signup_sessions_updated_at ON signup_sessions;
CREATE TRIGGER trg_signup_sessions_updated_at
BEFORE UPDATE ON signup_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Refresh Tokens 테이블
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    replaced_by_jti VARCHAR(255),
    user_agent TEXT,
    ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh Tokens 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS ux_refresh_tokens_jti ON refresh_tokens(jti);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_revoked ON refresh_tokens(revoked);

-- Refresh Tokens 트리거
DROP TRIGGER IF EXISTS trg_refresh_tokens_updated_at ON refresh_tokens;
CREATE TRIGGER trg_refresh_tokens_updated_at
BEFORE UPDATE ON refresh_tokens
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Terms Agreement Logs 테이블
CREATE TABLE IF NOT EXISTS terms_agreement_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tos BOOLEAN NOT NULL,
    privacy BOOLEAN NOT NULL,
    marketing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Terms Agreement Logs 인덱스
CREATE INDEX IF NOT EXISTS ix_terms_agreement_logs_user_id ON terms_agreement_logs(user_id);
CREATE INDEX IF NOT EXISTS ix_terms_agreement_logs_created_at ON terms_agreement_logs(created_at);

-- Auth SMS Codes 테이블 (OTP 저장용)
CREATE TABLE IF NOT EXISTS auth_sms_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_e164_norm VARCHAR(20) NOT NULL,
    code VARCHAR(10) NOT NULL,
    purpose VARCHAR(50) NOT NULL, -- 'register', 'login' 등
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auth SMS Codes 인덱스
CREATE INDEX IF NOT EXISTS ix_auth_sms_codes_phone ON auth_sms_codes(phone_e164_norm);
CREATE INDEX IF NOT EXISTS ix_auth_sms_codes_expires ON auth_sms_codes(expires_at);
CREATE INDEX IF NOT EXISTS ix_auth_sms_codes_purpose ON auth_sms_codes(purpose);

-- =====================================================
-- 정리 배치 쿼리 (5분/시간 단위 실행)
-- =====================================================

-- 만료된 회원가입 세션 정리
-- DELETE FROM signup_sessions WHERE expires_at < NOW();

-- 만료된 리프레시 토큰 비활성화
-- UPDATE refresh_tokens SET revoked = TRUE WHERE expires_at < NOW() AND revoked = FALSE;

-- 오래된 리프레시 토큰 삭제 (30일 이상)
-- DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '30 days';

-- 만료된 OTP 코드 삭제
-- DELETE FROM auth_sms_codes WHERE expires_at < NOW();

-- =====================================================
-- 샘플 데이터 (테스트용)
-- =====================================================

-- 테스트 사용자 (필요시)
-- INSERT INTO users (phone_e164_norm, phone_enc, nickname, is_verified, kyc_verified) 
-- VALUES ('+821012345678', encode('test', 'escape'), '테스트사용자', TRUE, TRUE)
-- ON CONFLICT (phone_e164_norm) DO NOTHING;
