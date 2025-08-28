import cron from "node-cron";
import { query } from "./db";
import { redis } from "./redis";

/**
 * 정리 배치 작업들
 */
export async function cleanupExpiredOtpCodes() {
  try {
    const result = await query(
      `DELETE FROM auth_sms_codes WHERE expire_at < NOW() - INTERVAL '1 day'`,
    );
    console.log(`[cleanup] 만료된 OTP 코드 ${result.rowCount}개 정리`);
  } catch (error) {
    console.error("[cleanup] OTP 코드 정리 실패:", error);
  }
}

export async function cleanupExpiredRefreshTokens() {
  try {
    // 임시로 테이블이 없으므로 로그만 출력
    console.log("[cleanup] 만료된 리프레시 토큰 정리 스킵 (테이블 없음)");
    // TODO: auth_refresh_tokens 테이블 생성 후 활성화
    // const result = await query(
    //   `DELETE FROM auth_refresh_tokens WHERE expires_at < NOW() - INTERVAL '1 day'`
    // );
    // console.log(`[cleanup] 만료된 리프레시 토큰 ${result.rowCount}개 정리`);
  } catch (error) {
    console.error("[cleanup] 리프레시 토큰 정리 실패:", error);
  }
}

export async function cleanupRedisExpiredKeys() {
  try {
    // Redis에서 만료된 키들 정리 (Redis는 자동으로 만료된 키를 제거하지만, 명시적으로 정리)
    const keys = await redis.keys("rl:otp:*");
    let count = 0;
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        await redis.del(key);
        count++;
      }
    }
    console.log(`[cleanup] Redis 만료된 키 ${count}개 정리`);
  } catch (error) {
    console.error("[cleanup] Redis 정리 실패:", error);
  }
}

/**
 * 모든 정리 작업 실행
 */
export async function runAllCleanup() {
  console.log("[cleanup] 정리 배치 작업 시작");
  await cleanupExpiredOtpCodes();
  await cleanupExpiredRefreshTokens();
  await cleanupRedisExpiredKeys();
  console.log("[cleanup] 정리 배치 작업 완료");
}

/**
 * 정기 정리 작업 스케줄러 설정
 */
export function setupCleanupScheduler() {
  // 매일 새벽 3시에 실행
  cron.schedule(
    "0 3 * * *",
    async () => {
      console.log("[cleanup] 정기 정리 작업 시작");
      await runAllCleanup();
    },
    {
      scheduled: true,
      timezone: "Asia/Seoul",
    },
  );

  // 개발 환경에서는 5분마다 실행 (테스트용)
  if (process.env.NODE_ENV === "development") {
    cron.schedule("*/5 * * * *", async () => {
      console.log("[cleanup] 개발환경 정리 작업 시작");
      await cleanupExpiredOtpCodes();
      await cleanupRedisExpiredKeys();
    });
  }

  console.log("[cleanup] 정리 스케줄러 설정 완료");
}
