// C:\projects\apps\server\scripts\migrate_minimal.js
const path = require("path");
const { Client } = require("pg");
const dotenv = require("dotenv");

// 1) 서버 로컬 .env 우선
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
// 2) 루트 .env 보조
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });

// 3) DATABASE_URL 비면 DB_*로 조합
if (!process.env.DATABASE_URL) {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
  if (DB_HOST && DB_PORT && DB_NAME && DB_USER) {
    process.env.DATABASE_URL = `postgres://${DB_USER}:${DB_PASSWORD || ""}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  }
}

const SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  phone_e164_norm TEXT UNIQUE NOT NULL,
  nickname TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sms_codes (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  phone_e164_norm TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expire_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempt_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_sms_codes_phone ON auth_sms_codes(phone_e164_norm);

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_addr TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_user ON auth_refresh_tokens(user_id);
`;

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query(SQL);
  await c.end();
  console.log("✅ minimal migrations applied");
})();
