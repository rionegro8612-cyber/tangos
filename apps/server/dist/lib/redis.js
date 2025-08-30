"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.getRedis = getRedis;
exports.ensureRedis = ensureRedis;
exports.closeRedis = closeRedis;
const redis_1 = require("redis");
let client = null;
let connecting = null;
function getRedis() {
    if (client)
        return client;
    client = (0, redis_1.createClient)({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
    client.on("error", (err) => console.error("[Redis] error:", err));
    return client;
}
async function ensureRedis() {
    const c = getRedis();
    if (c.isOpen)
        return c;
    if (!connecting) {
        connecting = c.connect().then(() => {
            connecting = null;
        }).catch((e) => {
            connecting = null;
            throw e;
        });
    }
    await connecting;
    return c;
}
async function closeRedis() {
    if (client && client.isOpen)
        await client.quit();
    client = null;
    connecting = null;
}
// 기존 export 유지 (하위 호환성)
exports.redis = getRedis();
