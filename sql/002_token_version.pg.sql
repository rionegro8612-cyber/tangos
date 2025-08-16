-- 002_token_version.pg.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

-- 안전용: NULL 방지
UPDATE users SET token_version = 0 WHERE token_version IS NULL;
