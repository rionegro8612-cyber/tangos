"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rlIncr = rlIncr;
exports.checkRate = checkRate;
exports.getRateLimitInfo = getRateLimitInfo;
exports.setOtp = setOtp;
exports.getOtp = getOtp;
exports.delOtp = delOtp;
exports.readIntFromEnv = readIntFromEnv;
const redis_1 = require("../lib/redis");
const memOTP = new Map();
const memRL = new Map();
function now() { return Date.now(); }
function parseIntSafe(v, d) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : d;
}
async function rlIncr(key, windowSec) {
    try {
        if (redis_1.redis && redis_1.redis.isOpen) {
            const n = await redis_1.redis.incr(key);
            if (n === 1)
                await redis_1.redis.expire(key, windowSec);
            console.log(`[rate-limit] Redis: ${key} -> ${n}`);
            return n;
        }
    }
    catch (e) {
        console.warn("[rate-limit] redis error:", e?.message);
    }
    // 🚨 메모리 폴백 로직 수정 및 디버깅
    const item = memRL.get(key);
    const currentTime = now();
    const exp = currentTime + windowSec * 1000;
    console.log(`[rate-limit] Memory fallback for ${key}:`, {
        existing: item ? { n: item.n, exp: item.exp, current: currentTime } : null,
        windowSec,
        newExp: exp
    });
    if (!item || item.exp < currentTime) {
        // 새로운 윈도우 시작
        const newItem = { n: 1, exp };
        memRL.set(key, newItem);
        console.log(`[rate-limit] New window: ${key} -> 1 (exp: ${exp})`);
        return 1;
    }
    else {
        // 기존 윈도우에서 카운터 증가
        item.n += 1;
        console.log(`[rate-limit] Increment: ${key} -> ${item.n} (exp: ${item.exp})`);
        return item.n;
    }
}
async function checkRate(key, limit, windowSec) {
    const n = await rlIncr(key, windowSec);
    return n <= limit;
}
// 레이트리밋 상세 정보 반환 함수 추가
async function getRateLimitInfo(key, limit, windowSec) {
    try {
        if (redis_1.redis && redis_1.redis.isOpen) {
            const current = await redis_1.redis.get(key);
            const n = current ? parseInt(current) : 0;
            const ttl = await redis_1.redis.ttl(key);
            const resetSec = ttl > 0 ? ttl : windowSec;
            return {
                current: n,
                limit,
                remaining: Math.max(0, limit - n),
                resetSec,
                isExceeded: n > limit
            };
        }
    }
    catch (e) {
        console.warn("[rate-limit] redis error:", e?.message);
    }
    // memory fallback
    const item = memRL.get(key);
    if (!item || item.exp < now()) {
        return {
            current: 0,
            limit,
            remaining: limit,
            resetSec: windowSec,
            isExceeded: false
        };
    }
    return {
        current: item.n,
        limit,
        remaining: Math.max(0, limit - item.n),
        resetSec: Math.ceil((item.exp - now()) / 1000),
        isExceeded: item.n > limit
    };
}
async function setOtp(phone, code, ttlSec) {
    try {
        if (redis_1.redis && redis_1.redis.isOpen) {
            await redis_1.redis.set(`otp:${phone}:code`, code, { EX: ttlSec });
            return;
        }
    }
    catch (e) {
        console.warn("[otp] redis set error:", e?.message);
    }
    memOTP.set(phone, { code, exp: now() + ttlSec * 1000 });
}
async function getOtp(phone) {
    try {
        if (redis_1.redis && redis_1.redis.isOpen) {
            return (await redis_1.redis.get(`otp:${phone}:code`));
        }
    }
    catch (e) {
        console.warn("[otp] redis get error:", e?.message);
    }
    const m = memOTP.get(phone);
    if (!m || m.exp < now())
        return null;
    return m.code;
}
async function delOtp(phone) {
    try {
        if (redis_1.redis && redis_1.redis.isOpen) {
            await redis_1.redis.del(`otp:${phone}:code`);
            return;
        }
    }
    catch (e) {
        console.warn("[otp] redis del error:", e?.message);
    }
    memOTP.delete(phone);
}
function readIntFromEnv(name, dflt) {
    return parseIntSafe(process.env[name], dflt);
}
