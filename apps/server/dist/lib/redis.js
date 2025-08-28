"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.ensureRedis = ensureRedis;
const redis_1 = require("redis");
const url = process.env.REDIS_URL || "redis://localhost:6379";
exports.redis = (0, redis_1.createClient)({ url });
exports.redis.on("error", (e) => console.error("[redis]", e));
async function ensureRedis() {
    if (!exports.redis.isOpen)
        await exports.redis.connect();
}
