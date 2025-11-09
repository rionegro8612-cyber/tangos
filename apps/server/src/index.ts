import app from "./app";
import { assertRedisReady } from "./lib/redis";
import { setupCleanupScheduler } from "./lib/cleanup";

// 테스트 환경에서는 서버를 시작하지 않음
if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT) || 4100;
  console.log(`[env] PORT=${process.env.PORT ?? "(undefined)"} → use ${port}`);

  (async () => {
    try {
      // Redis 연결 시도 (개발 환경에서는 선택적)
      const isDev = process.env.NODE_ENV === "development";
      const redisOptional = process.env.REDIS_OPTIONAL === "true" || isDev;
      
      try {
        await assertRedisReady();
        console.log("✅ Redis connection verified");
      } catch (redisError) {
        if (redisOptional) {
          console.warn("⚠️ Redis connection failed, but continuing in development mode");
          console.warn("   Some features (OTP, sessions) may not work without Redis");
          console.warn("   To fix: Start Redis locally or set REDIS_URL in .env");
        } else {
          console.error("🚫 Redis not ready. Abort start.", redisError);
          process.exit(1);
        }
      }
      
      app.listen(port, () => {
        console.log(`[server] listening on http://localhost:${port}`);
        console.log("=== SERVER STARTED ===", new Date().toISOString());
        setupCleanupScheduler();
      });
    } catch (e) {
      console.error("🚫 Server start failed:", e);
      process.exit(1);
    }
  })();
}
