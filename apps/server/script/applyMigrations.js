// apps/server/scripts/applyMigrations.js
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const candidates = [
  path.resolve(__dirname, "../../migrations"),
  path.resolve(__dirname, "./migrations"),
];
const MIG_DIR = candidates.find(fs.existsSync);
if (!MIG_DIR) {
  console.error("❌ migrations 폴더를 찾을 수 없습니다:", candidates.join(" | "));
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing in .env");

  const client = new Client({ connectionString: url });
  await client.connect();

  const files = fs
    .readdirSync(MIG_DIR)
    .filter((f) => /_up\.sql$/i.test(f))
    .sort((a, b) => a.localeCompare(b)); // 01_, 02_ 순서대로

  console.log("🗂  migrations dir:", MIG_DIR);
  console.log("📜 files:", files.join(", "));

  for (const f of files) {
    const full = path.join(MIG_DIR, f);
    const sql = fs.readFileSync(full, "utf-8");
    console.log(`\n▶ ${f}`);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`✔ applied: ${f}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`❌ failed: ${f}\n`, err.message);
      process.exit(1);
    }
  }

  await client.end();
  console.log("\n✅ All migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
