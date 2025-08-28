const { Client } = require("pg");

const DATABASE_URL = "postgres://tango:tango123@localhost:5432/tango";

async function checkUsers() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log("✅ PostgreSQL 연결 성공");

    console.log("\n👥 등록된 사용자 목록:");
    const result = await client.query(`
      SELECT id, phone_e164_norm, nickname, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);

    if (result.rows.length === 0) {
      console.log("  - 등록된 사용자가 없습니다.");
    } else {
      result.rows.forEach((row, index) => {
        console.log(
          `  ${index + 1}. ID: ${row.id}, 전화번호: ${row.phone_e164_norm}, 닉네임: ${row.nickname || "N/A"}, 생성일: ${row.created_at}`,
        );
      });
    }

    console.log(`\n📊 총 사용자 수: ${result.rows.length}`);
  } catch (error) {
    console.error("❌ 오류:", error.message);
  } finally {
    await client.end();
  }
}

checkUsers();
