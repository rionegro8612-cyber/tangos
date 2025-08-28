const { Client } = require("pg");

const conn = process.env.DATABASE_URL || "";
const isLocal = /:\/\/[^@]*@(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(conn);

const client = new Client({
  connectionString: conn,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

(async () => {
  await client.connect();
  const q =
    "SELECT phone_e164_norm, code, expires_at, used_at, created_at " +
    "FROM auth_sms_codes " +
    "WHERE used_at IS NULL AND expires_at > now() " +
    "ORDER BY id DESC LIMIT 5";
  const { rows } = await client.query(q);
  console.table(rows);
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
