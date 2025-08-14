CREATE TABLE IF NOT EXISTS signups_delegated (
    id BIGSERIAL PRIMARY KEY,
    phone_e164_norm VARCHAR(20) NOT NULL,
    referral_code TEXT,
    meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signups_delegated_phone
    ON signups_delegated (phone_e164_norm);
