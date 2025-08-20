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

-- users.age 컬럼 삭제(있다면)
ALTER TABLE users DROP COLUMN IF EXISTS age;
-- users.age 생성 칼럼으로 추가
ALTER TABLE users
  ADD COLUMN age INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM age(current_date, birth_date))::int) STORED;
-- name, birth_date NOT NULL 복구
ALTER TABLE users ALTER COLUMN name SET NOT NULL;
ALTER TABLE users ALTER COLUMN birth_date SET NOT NULL;