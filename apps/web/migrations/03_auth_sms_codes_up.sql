-- CREATE: auth_sms_codes
CREATE TABLE IF NOT EXISTS auth_sms_codes (
  id BIGSERIAL PRIMARY KEY,
  phone_e164_norm VARCHAR(20) NOT NULL,
  code_hash TEXT NOT NULL,                 -- 평문 저장 금지(sha256 등)
  purpose VARCHAR(20) NOT NULL,            -- 'login' | 'signup' | 'otp'
  try_count INT NOT NULL DEFAULT 0,
  max_try INT NOT NULL DEFAULT 5,
  expire_at TIMESTAMPTZ NOT NULL,          -- 표준 컬럼명 통일
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  request_ip INET,
  request_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_phone ON auth_sms_codes(phone_e164_norm);
CREATE INDEX IF NOT EXISTS idx_auth_codes_expire ON auth_sms_codes(expire_at);
