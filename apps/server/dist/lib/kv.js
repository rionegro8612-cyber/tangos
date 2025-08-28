"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setExStr = setExStr;
exports.setStr = setStr;
const redis_1 = require("./redis");
async function setExStr(key, seconds, value) {
    const v = typeof value === "string" ? value : JSON.stringify(value);
    return redis_1.redis.setEx(key, seconds, v); // node-redis v4: value는 string 이어야 함
}
async function setStr(key, value) {
    const v = typeof value === "string" ? value : JSON.stringify(value);
    return redis_1.redis.set(key, v);
}
