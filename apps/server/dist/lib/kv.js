"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setexStr = setexStr;
exports.setStr = setStr;
const redis_1 = require("./redis");
async function setexStr(key, seconds, value) {
    const v = typeof value === "string" ? value : JSON.stringify(value);
    return redis_1.redis.setex(key, seconds, v); // node-redis v4: value는 string 이어야 함
}
async function setStr(key, value) {
    const v = typeof value === "string" ? value : JSON.stringify(value);
    return redis_1.redis.set(key, v);
}
