const { Client } = require("pg");

const DATABASE_URL = "postgres://tango:tango123@localhost:5432/tango";

async function checkDetailedSchema() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log("✅ PostgreSQL 연결 성공");

    // 전체 테이블 목록
    const tablesResult = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log("\n📋 전체 테이블 목록:");
    tablesResult.rows.forEach((row) => {
      console.log(`  - ${row.table_name} (${row.table_type})`);
    });

    // users 테이블 상세 구조
    console.log("\n👥 users 테이블 상세 구조:");
    const usersResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);

    usersResult.rows.forEach((row) => {
      const length = row.character_maximum_length ? `(${row.character_maximum_length})` : "";
      const nullable = row.is_nullable === "NO" ? "NOT NULL" : "NULL";
      const defaultValue = row.column_default ? `DEFAULT ${row.column_default}` : "";
      console.log(
        `  - ${row.column_name}: ${row.data_type}${length} ${nullable} ${defaultValue}`.trim(),
      );
    });

    // users 테이블 제약조건
    console.log("\n🔒 users 테이블 제약조건:");
    const constraintsResult = await client.query(`
      SELECT constraint_name, constraint_type, table_name
      FROM information_schema.table_constraints 
      WHERE table_name = 'users'
      ORDER BY constraint_type, constraint_name
    `);

    constraintsResult.rows.forEach((row) => {
      console.log(`  - ${row.constraint_name}: ${row.constraint_type}`);
    });

    // auth_sms_codes 테이블 상세 구조
    console.log("\n📱 auth_sms_codes 테이블 상세 구조:");
    const smsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'auth_sms_codes' 
      ORDER BY ordinal_position
    `);

    smsResult.rows.forEach((row) => {
      const length = row.character_maximum_length ? `(${row.character_maximum_length})` : "";
      const nullable = row.is_nullable === "NO" ? "NOT NULL" : "NULL";
      const defaultValue = row.column_default ? `DEFAULT ${row.column_default}` : "";
      console.log(
        `  - ${row.column_name}: ${row.data_type}${length} ${nullable} ${defaultValue}`.trim(),
      );
    });

    // auth_refresh_tokens 테이블 구조
    console.log("\n🔑 auth_refresh_tokens 테이블 구조:");
    const refreshResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'auth_refresh_tokens' 
      ORDER BY ordinal_position
    `);

    refreshResult.rows.forEach((row) => {
      const length = row.character_maximum_length ? `(${row.character_maximum_length})` : "";
      const nullable = row.is_nullable === "NO" ? "NOT NULL" : "NULL";
      const defaultValue = row.column_default ? `DEFAULT ${row.column_default}` : "";
      console.log(
        `  - ${row.column_name}: ${row.data_type}${length} ${nullable} ${defaultValue}`.trim(),
      );
    });
  } catch (error) {
    console.error("❌ 오류:", error.message);
  } finally {
    await client.end();
  }
}

checkDetailedSchema();
