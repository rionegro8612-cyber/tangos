import { query } from "./db";

/**
 * 정리 배치 작업들
 * 개발: node-cron으로 5분/시간 단위 실행
 * 운영: 시스템 cron으로 실행
 */

export async function cleanupExpiredSignupSessions() {
  try {
    const result = await query(
      "DELETE FROM signup_sessions WHERE expires_at < NOW()"
    );
    console.log(`[CLEANUP] 만료된 회원가입 세션 ${result.rowCount}개 정리`);
  } catch (error) {
    console.error("[CLEANUP] 회원가입 세션 정리 실패:", error);
  }
}

export async function cleanupExpiredRefreshTokens() {
  try {
    // 만료된 토큰 비활성화
    const revokedResult = await query(
      "UPDATE refresh_tokens SET revoked = TRUE WHERE expires_at < NOW() AND revoked = FALSE"
    );
    console.log(`[CLEANUP] 만료된 리프레시 토큰 ${revokedResult.rowCount}개 비활성화`);

    // 오래된 토큰 삭제 (30일 이상)
    const deletedResult = await query(
      "DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '30 days'"
    );
    console.log(`[CLEANUP] 오래된 리프레시 토큰 ${deletedResult.rowCount}개 삭제`);
  } catch (error) {
    console.error("[CLEANUP] 리프레시 토큰 정리 실패:", error);
  }
}

export async function cleanupExpiredOtpCodes() {
  try {
    const result = await query(
      "DELETE FROM auth_sms_codes WHERE expires_at < NOW()"
    );
    console.log(`[CLEANUP] 만료된 OTP 코드 ${result.rowCount}개 정리`);
  } catch (error) {
    console.error("[CLEANUP] OTP 코드 정리 실패:", error);
  }
}

/**
 * 모든 정리 작업 실행
 */
export async function runAllCleanup() {
  console.log("[CLEANUP] 정리 배치 시작");
  
  await Promise.all([
    cleanupExpiredSignupSessions(),
    cleanupExpiredRefreshTokens(),
    cleanupExpiredOtpCodes()
  ]);
  
  console.log("[CLEANUP] 정리 배치 완료");
}

/**
 * 개발 환경용 스케줄러 설정
 * 운영 환경에서는 시스템 cron 사용 권장
 */
export function setupCleanupScheduler() {
  if (process.env.NODE_ENV === "production") {
    console.log("[CLEANUP] 운영 환경: 시스템 cron 사용 권장");
    return;
  }

  try {
    const cron = require("node-cron");
    
    // 5분마다 실행
    cron.schedule("*/5 * * * *", async () => {
      console.log("[CLEANUP] 5분 정리 배치 실행");
      await cleanupExpiredOtpCodes();
    });
    
    // 1시간마다 실행
    cron.schedule("0 * * * *", async () => {
      console.log("[CLEANUP] 1시간 정리 배치 실행");
      await cleanupExpiredSignupSessions();
      await cleanupExpiredRefreshTokens();
    });
    
    console.log("[CLEANUP] 개발 환경 스케줄러 설정 완료");
  } catch (error) {
    console.warn("[CLEANUP] node-cron 설치 필요: npm install node-cron");
    console.warn("[CLEANUP] 수동으로 정리 배치 실행 가능");
  }
}
