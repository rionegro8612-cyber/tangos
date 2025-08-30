"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const redis_1 = require("./lib/redis");
const cleanup_1 = require("./lib/cleanup");
// 테스트 환경에서는 서버를 시작하지 않음
if (process.env.NODE_ENV !== "test") {
    const port = Number(process.env.PORT) || 4100;
    console.log(`[env] PORT=${process.env.PORT ?? "(undefined)"} → use ${port}`);
    (async () => {
        await (0, redis_1.ensureRedis)();
        app_1.default.listen(port, () => {
            console.log(`[server] listening on http://localhost:${port}`);
            console.log("=== SERVER STARTED ===", new Date().toISOString());
            (0, cleanup_1.setupCleanupScheduler)();
        });
    })();
}
