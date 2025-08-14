-- OTP codes issuance/verification logs
CREATE TABLE IF NOT EXISTS auth_sms_codes (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID NOT NULL UNIQUE,
    phone_e164_norm VARCHAR(20) NOT NULL,
    code_hash TEXT NOT NULL,
    sent_via TEXT,
    expire_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0,
    ip INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_phone_created
    ON auth_sms_codes (phone_e164_norm, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_expire_at
    ON auth_sms_codes (expire_at);
