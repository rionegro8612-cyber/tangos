const { Client } = require("pg");

const DATABASE_URL = "postgres://tango:tango123@localhost:5432/tango";

async function traceUserCreation() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log("✅ PostgreSQL 연결 성공");

    console.log("\n🔍 사용자 생성 과정 추적...");

    // 1. 최근 생성된 사용자 확인
    console.log("\n👥 최근 생성된 사용자들:");
    const recentUsers = await client.query(`
      SELECT id, phone_e164_norm, nickname, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    recentUsers.rows.forEach((row, index) => {
      console.log(
        `  ${index + 1}. ID: ${row.id}, 전화번호: ${row.phone_e164_norm}, 생성일: ${row.created_at}`,
      );
    });

    // 2. 특정 전화번호로 사용자 검색
    const testPhone = "+821077778888";
    console.log(`\n📱 ${testPhone} 사용자 상세 정보:`);
    const userDetail = await client.query(
      `
      SELECT * FROM users WHERE phone_e164_norm = $1
    `,
      [testPhone],
    );

    if (userDetail.rows.length > 0) {
      const user = userDetail.rows[0];
      console.log(`  - ID: ${user.id}`);
      console.log(`  - 전화번호: ${user.phone_e164_norm}`);
      console.log(`  - 닉네임: ${user.nickname || "N/A"}`);
      console.log(`  - 생성일: ${user.created_at}`);
      console.log(`  - 업데이트일: ${user.updated_at || "N/A"}`);
    } else {
      console.log(`  - 사용자를 찾을 수 없습니다.`);
    }

    // 3. 데이터베이스 트리거 확인
    console.log("\n🔍 데이터베이스 트리거 확인:");
    const triggers = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers 
      WHERE event_object_table = 'users'
    `);

    if (triggers.rows.length > 0) {
      triggers.rows.forEach((trigger, index) => {
        console.log(`  ${index + 1}. ${trigger.trigger_name}: ${trigger.event_manipulation}`);
        console.log(`     실행: ${trigger.action_statement}`);
      });
    } else {
      console.log(`  - users 테이블에 트리거가 없습니다.`);
    }
  } catch (error) {
    console.error("❌ 오류:", error.message);
  } finally {
    await client.end();
  }
}

traceUserCreation();
