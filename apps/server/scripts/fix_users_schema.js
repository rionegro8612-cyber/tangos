const { Client } = require("pg");

const DATABASE_URL = "postgres://tango:tango123@localhost:5432/tango";

const SQL_FIXES = [
  // users 테이블에 누락된 컬럼들 추가
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_enc BYTEA`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_provider TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_checked_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE`,

  // auth_sms_codes 테이블에 used_at 컬럼 추가 (verified_at과 별도)
  `ALTER TABLE auth_sms_codes ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ`,

  // users 테이블에 updated_at 컬럼과 트리거 추가
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,

  // updated_at 트리거 함수 생성
  `CREATE OR REPLACE FUNCTION set_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = NOW();
     RETURN NEW;
   END;
   $$ language 'plpgsql'`,

  // updated_at 트리거 생성
  `DROP TRIGGER IF EXISTS trg_users_updated_at ON users`,
  `CREATE TRIGGER trg_users_updated_at
   BEFORE UPDATE ON users
   FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
];

async function fixSchema() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log("✅ PostgreSQL 연결 성공");

    console.log("🔧 스키마 수정 시작...");

    for (let i = 0; i < SQL_FIXES.length; i++) {
      const sql = SQL_FIXES[i];
      try {
        await client.query(sql);
        console.log(`  ✅ ${i + 1}/${SQL_FIXES.length}: ${sql.substring(0, 50)}...`);
      } catch (error) {
        console.log(`  ⚠️  ${i + 1}/${SQL_FIXES.length}: ${error.message}`);
      }
    }

    console.log("\n✅ 스키마 수정 완료!");

    // 수정된 스키마 확인
    console.log("\n🔍 수정된 users 테이블 구조:");
    const usersResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);

    usersResult.rows.forEach((row) => {
      console.log(
        `  - ${row.column_name}: ${row.data_type} ${row.is_nullable === "NO" ? "NOT NULL" : "NULL"} ${row.column_default ? `DEFAULT ${row.column_default}` : ""}`,
      );
    });
  } catch (error) {
    console.error("❌ 오류:", error.message);
  } finally {
    await client.end();
  }
}

fixSchema();
