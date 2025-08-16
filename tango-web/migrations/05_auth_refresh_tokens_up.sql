CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id           BIGSERIAL    PRIMARY KEY,
  user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(128) NOT NULL,  -- SHA-256(hex)
  expires_at   TIMESTAMPTZ  NOT NULL,
  revoked_at   TIMESTAMPTZ  NULL,
  user_agent   TEXT         NULL,
  ip_addr      INET         NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_rft_user
  ON auth_refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_rft_valid
  ON auth_refresh_tokens(expires_at)
  WHERE revoked_at IS NULL;
