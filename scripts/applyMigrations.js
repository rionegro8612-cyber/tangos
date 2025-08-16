const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// 1) .env 탐색 (루트 한 개만 쓰는 전제)
const envCandidates = [
  path.resolve(__dirname, "../../../.env"), // C:\projects\.env (권장 위치)
  path.resolve(__dirname, "../../.env"),    // C:\projects\apps\.env (차선)
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../../../.env"),
].filter(p => fs.existsSync(p));

if (envCandidates[0]) {
  require("dotenv").config({ path: envCandidates[0] });
  console.log("��� loaded .env:", envCandidates[0]);
} else {
  console.warn("⚠️  .env not found via candidates — relying on process.env");
}

// 2) DATABASE_URL이 없으면 DB_*로 조합
let { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
  if (DB_HOST && DB_PORT && DB_NAME && DB_USER) {
    DATABASE_URL = `postgres://${DB_USER}:${DB_PASSWORD || ""}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
    console.log("��� composed DATABASE_URL from DB_*:", DATABASE_URL);
  } else {
    throw new Error("DATABASE_URL or DB_* envs are required.");
  }
}

// 3) migrations 디렉터리 자동 탐색
const migCandidates = [
  path.resolve(__dirname, "../../../migrations"), // C:\projects\migrations
  path.resolve(__dirname, "../../migrations"),    // C:\projects\apps\migrations
  path.resolve(process.cwd(), "../../migrations"),
  path.resolve(process.cwd(), "./migrations"),
].filter(p => fs.existsSync(p));

const MIG_DIR = migCandidates[0];
if (!MIG_DIR) {
  throw new Error("migrations directory not found. Tried:\n" + migCandidates.join("\n"));
}
console.log("���  migrations dir:", MIG_DIR);

// 4) _up.sql들만 순서대로 실행
(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const files = fs.readdirSync(MIG_DIR)
    .filter(f => /_up\.sql$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log("ℹ️  no *_up.sql files in", MIG_DIR);
    await client.end();
    return;
  }

  console.log("��� files:", files.join(", "));

  for (const f of files) {
    const full = path.join(MIG_DIR, f);
    const sql = fs.readFileSync(full, "utf8");
    process.stdout.write(`\n▶ ${f} ... `);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log("OK");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("FAIL\n", err.message);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("\n✅ All migrations applied.");
})().catch(e => {
  console.error(e);
  process.exit(1);
});
