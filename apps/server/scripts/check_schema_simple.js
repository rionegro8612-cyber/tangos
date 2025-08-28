const { Client } = require("pg");

const DATABASE_URL = "postgres://tango:tango123@localhost:5432/tango";

async function checkSchema() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log("✅ PostgreSQL 연결 성공");

    // 테이블 목록 확인
    const tablesResult = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log("\n📋 생성된 테이블:");
    tablesResult.rows.forEach((row) => {
      console.log(`  - ${row.table_name} (${row.table_type})`);
    });

    // users 테이블 구조 확인
    if (tablesResult.rows.some((r) => r.table_name === "users")) {
      console.log("\n👥 users 테이블 구조:");
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

      // phone_e164_norm UNIQUE 제약조건 확인
      const uniqueResult = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints 
        WHERE table_name = 'users' AND constraint_type = 'UNIQUE'
      `);

      console.log("\n🔒 users 테이블 제약조건:");
      uniqueResult.rows.forEach((row) => {
        console.log(`  - ${row.constraint_name}: ${row.constraint_type}`);
      });
    }

    // auth_sms_codes 테이블 구조 확인
    if (tablesResult.rows.some((r) => r.table_name === "auth_sms_codes")) {
      console.log("\n📱 auth_sms_codes 테이블 구조:");
      const smsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'auth_sms_codes' 
        ORDER BY ordinal_position
      `);

      smsResult.rows.forEach((row) => {
        console.log(
          `  - ${row.column_name}: ${row.data_type} ${row.is_nullable === "NO" ? "NOT NULL" : "NULL"} ${row.column_default ? `DEFAULT ${row.column_default}` : ""}`,
        );
      });
    }
  } catch (error) {
    console.error("❌ 오류:", error.message);
  } finally {
    await client.end();
  }
}

checkSchema();
