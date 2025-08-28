const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5433/tango",
});

async function checkSchema() {
  const client = await pool.connect();
  try {
    console.log("🔍 Users 테이블 스키마 확인 중...\n");

    // 테이블 존재 여부 확인
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log("❌ users 테이블이 존재하지 않습니다.");
      return;
    }

    console.log("✅ users 테이블이 존재합니다.\n");

    // 컬럼 정보 조회
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);

    console.log("📋 현재 컬럼 구조:");
    console.log("─".repeat(60));
    columns.rows.forEach((col) => {
      const nullable = col.is_nullable === "YES" ? "NULL" : "NOT NULL";
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : "";
      console.log(
        `${col.column_name.padEnd(20)} | ${col.data_type.padEnd(15)} | ${nullable.padEnd(8)} |${defaultVal}`,
      );
    });
    console.log("─".repeat(60));

    // 인덱스 정보 조회
    const indexes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'users';
    `);

    if (indexes.rows.length > 0) {
      console.log("\n🔍 현재 인덱스:");
      indexes.rows.forEach((idx) => {
        console.log(`- ${idx.indexname}: ${idx.indexdef}`);
      });
    }

    // 제약조건 확인
    const constraints = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'users'::regclass;
    `);

    if (constraints.rows.length > 0) {
      console.log("\n🔒 현재 제약조건:");
      constraints.rows.forEach((con) => {
        console.log(`- ${con.conname} (${con.contype}): ${con.definition}`);
      });
    }
  } catch (error) {
    console.error("❌ 스키마 확인 중 오류:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
