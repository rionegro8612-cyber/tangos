"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.getRedis = getRedis;
exports.assertRedisReady = assertRedisReady;
exports.ensureRedis = ensureRedis;
exports.closeRedis = closeRedis;
const ioredis_1 = __importDefault(require("ioredis"));
let client = null;
function makeRedis() {
    const url = process.env.REDIS_URL;
    if (url) {
        return new ioredis_1.default(url, {
            maxRetriesPerRequest: 2,
            enableReadyCheck: true,
        });
    }
    return new ioredis_1.default({
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB || 0),
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
    });
}
function getRedis() {
    if (!client) {
        client = makeRedis();
        client.on("connect", () => console.log("🔌 Redis connecting..."));
        client.on("ready", () => console.log("✅ Redis ready"));
        client.on("error", (e) => console.error("❌ Redis error:", e?.message || e));
        client.on("end", () => console.warn("⚠️ Redis connection ended"));
    }
    return client;
}
async function assertRedisReady() {
    const r = getRedis();
    const pong = await r.ping();
    if (pong !== "PONG")
        throw new Error("Redis ping failed");
}
// 기존 코드와의 호환성을 위한 export
exports.redis = getRedis();
async function ensureRedis() {
    return getRedis();
}
async function closeRedis() {
    if (client && client.status === "ready") {
        await client.quit();
    }
    client = null;
}
