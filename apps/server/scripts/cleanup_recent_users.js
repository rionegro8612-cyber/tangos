const { Client } = require("pg");

const DATABASE_URL = "postgres://tango:tango123@localhost:5432/tango";

async function cleanupRecentUsers() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log("✅ PostgreSQL 연결 성공");

    console.log("\n🧹 최근 생성된 테스트 사용자 정리...");

    // 최근 생성된 사용자들 확인
    const recentUsers = await client.query(`
      SELECT id, phone_e164_norm, created_at 
      FROM users 
      WHERE created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
    `);

    if (recentUsers.rows.length === 0) {
      console.log("  - 최근 1시간 내 생성된 사용자가 없습니다.");
      return;
    }

    console.log(`📱 최근 1시간 내 생성된 사용자 ${recentUsers.rows.length}명:`);
    recentUsers.rows.forEach((row, index) => {
      console.log(
        `  ${index + 1}. ID: ${row.id}, 전화번호: ${row.phone_e164_norm}, 생성일: ${row.created_at}`,
      );
    });

    // 테스트 전화번호 패턴으로 사용자 삭제
    const testPhonePattern = /^\+8210[0-9]{8}$/;
    let deletedCount = 0;

    for (const user of recentUsers.rows) {
      if (testPhonePattern.test(user.phone_e164_norm)) {
        try {
          // 관련 OTP 코드 삭제
          await client.query("DELETE FROM auth_sms_codes WHERE phone_e164_norm = $1", [
            user.phone_e164_norm,
          ]);

          // 사용자 삭제
          await client.query("DELETE FROM users WHERE id = $1", [user.id]);

          console.log(`  ✅ ${user.phone_e164_norm} → ID ${user.id} 삭제됨`);
          deletedCount++;
        } catch (error) {
          console.log(`  ❌ ${user.phone_e164_norm} → 삭제 실패: ${error.message}`);
        }
      }
    }

    console.log(`\n📊 총 ${deletedCount}명의 테스트 사용자 삭제 완료`);

    // 정리 후 사용자 수 확인
    const userCount = await client.query("SELECT COUNT(*) FROM users");
    console.log(`📊 정리 후 총 사용자 수: ${userCount.rows[0].count}`);
  } catch (error) {
    console.error("❌ 오류:", error.message);
  } finally {
    await client.end();
  }
}

cleanupRecentUsers();
