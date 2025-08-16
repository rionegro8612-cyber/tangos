// C:\projects\apps\server\scripts\check_db.js
const path = require("path");
const { Client } = require("pg");
const dotenv = require("dotenv");

// 1) 서버 로컬 .env 우선 로드
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
// 2) 루트 .env 보조 로드(이미 있으면 덮지 않음)
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });

// 3) DATABASE_URL 비어있으면 DB_*로 조합
if (!process.env.DATABASE_URL) {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
  if (DB_HOST && DB_PORT && DB_NAME && DB_USER) {
    process.env.DATABASE_URL = `postgres://${DB_USER}:${DB_PASSWORD || ""}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  }
}

(async () => {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL missing");
    const c = new Client({ connectionString: url });
    await c.connect();

    const u = await c.query("select to_regclass('public.users') as t");
    const s = await c.query("select to_regclass('public.auth_sms_codes') as t");
    const r = await c.query("select to_regclass('public.auth_refresh_tokens') as t");
    const f = await c.query("select exists(select 1 from pg_proc where proname='gen_random_uuid') as f");

    console.log("users table:               ", u.rows[0].t);
    console.log("auth_sms_codes table:      ", s.rows[0].t);
    console.log("auth_refresh_tokens table: ", r.rows[0].t);
    console.log("gen_random_uuid function:  ", f.rows[0].f);

    await c.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
