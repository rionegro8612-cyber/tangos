"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canSend = canSend;
exports.putCode = putCode;
exports.getRecord = getRecord;
exports.incAttempt = incAttempt;
exports.clear = clear;
exports.isLocked = isLocked;
exports.getConstants = getConstants;
exports.generateCode = generateCode;
exports.verifyCode = verifyCode;
const store = new Map();
const SEC = 1000;
const MIN = 60 * SEC;
const TTL_SEC = Number(process.env.OTP_CODE_TTL_SEC ?? 180);
const RESEND_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SEC ?? 60);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
const LOCK_MIN = Number(process.env.OTP_LOCK_MINUTES ?? 10);
function canSend(phone) {
    const now = Date.now();
    const rec = store.get(phone);
    if (!rec)
        return { ok: true, waitMs: 0 };
    const waitMs = (rec.lastSentAt ?? 0) + RESEND_COOLDOWN_SEC * SEC - now;
    return { ok: waitMs <= 0, waitMs: Math.max(0, waitMs) };
}
function putCode(phone, code, purpose) {
    const now = Date.now();
    const rec = {
        code,
        expiresAt: now + TTL_SEC * SEC,
        attempts: 0,
        lastSentAt: now,
        lockedUntil: undefined,
    };
    // 목적별로 다른 키 사용
    const key = purpose ? `${purpose}:${phone}` : phone;
    if (purpose) {
        purposeStore.set(key, rec);
    }
    else {
        store.set(key, rec);
    }
    return rec;
}
function getRecord(phone) {
    return store.get(phone);
}
function incAttempt(phone) {
    const rec = store.get(phone);
    if (!rec)
        return 0;
    rec.attempts += 1;
    if (rec.attempts >= MAX_ATTEMPTS) {
        rec.lockedUntil = Date.now() + LOCK_MIN * MIN;
    }
    return rec.attempts;
}
function clear(phone) {
    store.delete(phone);
}
function isLocked(phone) {
    const rec = store.get(phone);
    if (!rec || !rec.lockedUntil)
        return false;
    if (Date.now() < rec.lockedUntil)
        return true;
    rec.lockedUntil = undefined;
    rec.attempts = 0;
    return false;
}
function getConstants() {
    return { TTL_SEC, RESEND_COOLDOWN_SEC, MAX_ATTEMPTS, LOCK_MIN };
}
// ✅ 목적별 OTP 스토어 분리
const purposeStore = new Map();
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function verifyCode(phone, code, purpose) {
    const key = purpose ? `${purpose}:${phone}` : phone;
    const targetStore = purpose ? purposeStore : store;
    const rec = targetStore.get(key);
    if (!rec)
        return false;
    if (rec.lockedUntil && Date.now() < rec.lockedUntil)
        return false;
    if (Date.now() > rec.expiresAt)
        return false;
    if (rec.code !== code) {
        incAttempt(phone);
        return false;
    }
    // 목적별 스토어에서 제거
    targetStore.delete(key);
    return true;
}
