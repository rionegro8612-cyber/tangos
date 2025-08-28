const { Client } = require("pg");

const DATABASE_URL = "postgres://tango:tango123@localhost:5432/tango";

async function checkSmsTable() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log("✅ PostgreSQL 연결 성공");

    console.log("\n📱 auth_sms_codes 테이블 구조:");
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'auth_sms_codes' 
      ORDER BY ordinal_position
    `);

    result.rows.forEach((row) => {
      const length = row.character_maximum_length ? `(${row.character_maximum_length})` : "";
      const nullable = row.is_nullable === "NO" ? "NOT NULL" : "NULL";
      const defaultValue = row.column_default ? `DEFAULT ${row.column_default}` : "";
      console.log(
        `  - ${row.column_name}: ${row.data_type}${length} ${nullable} ${defaultValue}`.trim(),
      );
    });

    // 인덱스 확인
    console.log("\n🔍 auth_sms_codes 인덱스:");
    const indexResult = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'auth_sms_codes'
    `);

    indexResult.rows.forEach((row) => {
      console.log(`  - ${row.indexname}: ${row.indexdef}`);
    });
  } catch (error) {
    console.error("❌ 오류:", error.message);
  } finally {
    await client.end();
  }
}

checkSmsTable();
