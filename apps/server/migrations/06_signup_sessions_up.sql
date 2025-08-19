
-- signup_sessions: tracks phone verification state during registration
CREATE TABLE IF NOT EXISTS signup_sessions (
    id BIGSERIAL PRIMARY KEY,
    phone_e164_norm VARCHAR(20) NOT NULL UNIQUE,
    carrier VARCHAR(20),
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    purpose VARCHAR(20) NOT NULL DEFAULT 'register',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_sessions_expires_at
    ON signup_sessions (expires_at);

DROP TRIGGER IF EXISTS trg_signup_sessions_updated_at ON signup_sessions;
CREATE TRIGGER trg_signup_sessions_updated_at
BEFORE UPDATE ON signup_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
