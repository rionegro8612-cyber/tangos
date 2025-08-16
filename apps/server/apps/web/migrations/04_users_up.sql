CREATE TABLE IF NOT EXISTS users (
  id               BIGSERIAL PRIMARY KEY,
  phone_e164_norm  VARCHAR(32)  NOT NULL UNIQUE,
  nickname         VARCHAR(40)  NULL,
  last_login_at    TIMESTAMPTZ  NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
