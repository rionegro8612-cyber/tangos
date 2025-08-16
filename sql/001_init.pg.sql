-- apps/server/sql/001_init.pg.sql
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  phone_e164_norm VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  birth CHAR(8),
  is_kyc_verified BOOLEAN NOT NULL DEFAULT FALSE,
  kyc_verified_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sms_codes (
  id BIGSERIAL PRIMARY KEY,
  phone_e164_norm VARCHAR(20) NOT NULL,
  code_hash BYTEA NOT NULL,
  expire_at TIMESTAMP NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP NULL,
  request_id VARCHAR(64) NOT NULL,
  ip_addr INET NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_phone  ON auth_sms_codes(phone_e164_norm);
CREATE INDEX IF NOT EXISTS idx_auth_expire ON auth_sms_codes(expire_at);