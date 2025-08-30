"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueCode = issueCode;
exports.verifyCode = verifyCode;
const db_1 = require("../../db");
const otpUtil_1 = require("./otpUtil");
const crypto_1 = require("crypto");
function isDevOtpOn() {
    const providerIsMock = String(process.env.SMS_PROVIDER || "")
        .trim()
        .toLowerCase() === "mock";
    const debugOtpOn = ["1", "true", "yes", "on"].includes(String(process.env.DEBUG_OTP ?? "")
        .trim()
        .toLowerCase());
    return providerIsMock || debugOtpOn;
}
async function issueCode(rawPhone, opts) {
    const phone = (0, otpUtil_1.e164)(rawPhone);
    if (!phone) {
        return { ok: false, code: "INVALID_PHONE", message: "invalid phone" };
    }
    // (선택) 오래된 레코드 청소
    await (0, db_1.query)(`DELETE FROM auth_sms_codes WHERE expire_at < NOW() - INTERVAL '1 day'`);
    // 최근 발송 이력 조회 (쿨다운)
    const recent = await (0, db_1.query)(`SELECT created_at FROM auth_sms_codes
     WHERE phone_e164_norm = $1
     ORDER BY created_at DESC
     LIMIT 1`, [phone]);
    const last = recent[0]?.created_at ? new Date(recent[0].created_at).getTime() : 0;
    const now = Date.now();
    const cooldownMs = Number(process.env.OTP_RESEND_COOLDOWN_SEC ?? 60) * 1000;
    if (last && now - last < cooldownMs) {
        const left = Math.ceil((cooldownMs - (now - last)) / 1000);
        return { ok: false, code: "RESEND_COOLDOWN", message: "resend cooldown", retryAfterSec: left };
    }
    // 안전한 난수로 OTP 생성
    const len = Math.min(Math.max(Number(process.env.OTP_CODE_LEN ?? 6), 4), 8); // 4~8자리
    const code = (0, crypto_1.randomInt)(0, 10 ** len)
        .toString()
        .padStart(len, "0");
    const salt = (0, otpUtil_1.newSalt)();
    const hash = (0, otpUtil_1.hashCode)(code, salt);
    const ttlSec = Number(process.env.OTP_CODE_TTL_SEC ?? 180);
    const rows = await (0, db_1.query)(`INSERT INTO auth_sms_codes (request_id, phone_e164_norm, code_hash, expire_at)
     VALUES (gen_random_uuid(), $1, $2, NOW() + ($3 || ' seconds')::interval)
     RETURNING id, request_id, expire_at`, [phone, `${hash}:${salt}`, String(ttlSec)]);
    const row = rows[0];
    // mock/DEBUG_OTP 또는 forceDev면 평문 코드 동봉
    const _codeForDev = opts?.forceDev || isDevOtpOn() ? code : undefined;
    return {
        ok: true,
        phoneE164: phone,
        requestId: row.request_id,
        expiresInSec: ttlSec,
        _codeForDev,
    };
}
async function verifyCode(rawPhone, code) {
    const phone = (0, otpUtil_1.e164)(rawPhone);
    if (!phone)
        return { ok: false, code: "INVALID_PHONE", message: "invalid phone" };
    const rows = await (0, db_1.query)(`SELECT id, request_id, phone_e164_norm, code_hash, expire_at, used_at, attempt_count, created_at
     FROM auth_sms_codes
     WHERE phone_e164_norm = $1
     ORDER BY created_at DESC
     LIMIT 1`, [phone]);
    const rec = rows[0];
    if (!rec)
        return { ok: false, code: "NO_CODE", message: "no code issued" };
    // 만료/사용됨 체크
    if (Date.now() > new Date(rec.expire_at).getTime()) {
        return { ok: false, code: "EXPIRED", message: "code expired" };
    }
    if (rec.used_at)
        return { ok: false, code: "ALREADY_USED", message: "code already used" };
    // 시도 횟수 제한
    const maxAttempts = Number(process.env.MAX_OTP_ATTEMPTS ?? 5);
    if ((rec.attempt_count ?? 0) >= maxAttempts) {
        await (0, db_1.query)(`UPDATE auth_sms_codes SET used_at = NOW() WHERE id = $1`, [rec.id]);
        return { ok: false, code: "TOO_MANY_ATTEMPTS", message: "too many attempts" };
    }
    // 검증
    const [storedHash, salt] = rec.code_hash.split(":");
    const calc = (0, otpUtil_1.hashCode)(code, salt);
    if (calc !== storedHash) {
        const next = rec.attempt_count + 1;
        await (0, db_1.query)(`UPDATE auth_sms_codes SET attempt_count = $1 WHERE id = $2`, [next, rec.id]);
        if (next >= maxAttempts) {
            await (0, db_1.query)(`UPDATE auth_sms_codes SET used_at = NOW() WHERE id = $1`, [rec.id]);
            return { ok: false, code: "TOO_MANY_ATTEMPTS", message: "too many attempts" };
        }
        return { ok: false, code: "INVALID_CODE", message: "invalid code" };
    }
    await (0, db_1.query)(`UPDATE auth_sms_codes SET used_at = NOW() WHERE id = $1`, [rec.id]);
    return { ok: true, phoneE164: phone };
}
