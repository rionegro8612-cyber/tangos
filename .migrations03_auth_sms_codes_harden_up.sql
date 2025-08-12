-- 03_auth_sms_codes_harden_up.sql  (fresh install)

CREATE TABLE IF NOT EXISTS auth_sms_codes (
  id               BIGSERIAL PRIMARY KEY,
  phone_e164_norm  VARCHAR(32)  NOT NULL,
  code_hash        VARCHAR(128) NOT NULL,
  code_salt        VARCHAR(32)  NOT NULL,
  purpose          VARCHAR(32)  NOT NULL DEFAULT 'login',
  expires_at       TIMESTAMPTZ  NOT NULL,
  verified_at      TIMESTAMPTZ  NULL,
  attempts         INTEGER      NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  sent_count       INTEGER      NOT NULL DEFAULT 1 CHECK (sent_count >= 1),
  trace_id         VARCHAR(64)  NULL,
  meta             JSONB        NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_phone_purpose_created
  ON auth_sms_codes (phone_e164_norm, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_expires
  ON auth_sms_codes (expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_active_partial
  ON auth_sms_codes (phone_e164_norm, purpose, created_at DESC)
  WHERE verified_at IS NULL AND expires_at > NOW();
