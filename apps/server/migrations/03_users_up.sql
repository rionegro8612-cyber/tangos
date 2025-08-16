-- Users: core profile with phone normalization/encryption and KYC flags
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

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
