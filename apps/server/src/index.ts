import app from "./app";
import { ensureRedis } from "./lib/redis";
import { setupCleanupScheduler } from "./lib/cleanup";

// 테스트 환경에서는 서버를 시작하지 않음
if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT) || 4100;
  console.log(`[env] PORT=${process.env.PORT ?? "(undefined)"} → use ${port}`);

  (async () => {
    await ensureRedis();
    app.listen(port, () => {
      console.log(`[server] listening on http://localhost:${port}`);
      console.log("=== SERVER STARTED ===", new Date().toISOString());
      setupCleanupScheduler();
    });
  })();
}
