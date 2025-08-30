"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hash = exports.genCode = void 0;
exports.canSend = canSend;
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = require("../lib/redis");
const genCode = () => "" + Math.floor(100000 + Math.random() * 900000);
exports.genCode = genCode;
const hash = (s) => crypto_1.default.createHash("sha256").update(s).digest("hex");
exports.hash = hash;
const WINDOW_SEC = 10 * 60; // 10분
const LIMIT_PER_PHONE = 5;
const LIMIT_PER_IP = 20;
async function canSend(phone, ip) {
    const kPhone = `rl:otp:phone:${phone}`;
    const kIP = `rl:otp:ip:${ip}`;
    const p = redis_1.redis.multi().incr(kPhone).expire(kPhone, WINDOW_SEC).incr(kIP).expire(kIP, WINDOW_SEC);
    const res = await p.exec();
    // Redis multi exec 결과 타입 안전하게 처리
    if (!res)
        return false;
    const phoneCount = Number(res[0] ?? 0);
    const ipCount = Number(res[2] ?? 0);
    return phoneCount <= LIMIT_PER_PHONE && ipCount <= LIMIT_PER_IP;
}
