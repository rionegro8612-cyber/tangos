"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserWithKyc = createUserWithKyc;
exports.findByPhone = findByPhone;
const db_1 = require("../db");
// 🚨 전화번호 E.164 정규화 함수
function normalizePhoneE164(phone) {
    const digits = phone.replace(/\D/g, ""); // 숫자만 추출
    if (digits.startsWith("0")) {
        return `+82${digits.substring(1)}`; // 0 제거하고 +82 추가
    }
    if (digits.startsWith("82")) {
        return `+${digits}`; // 82로 시작하면 + 추가
    }
    if (!digits.startsWith("+82")) {
        return `+82${digits}`; // +82가 없으면 추가
    }
    return phone; // 이미 +82 형식이면 그대로
}
/** minimal user creation compatible with existing users schema */
async function createUserWithKyc(input) {
    // 🚨 전화번호 E.164 정규화 적용
    const normalizedPhone = normalizePhoneE164(input.phone);
    console.log("[REGISTER create]", {
        raw: input.phone,
        normalized: normalizedPhone,
        input,
    });
    const rows = await (0, db_1.query)(`
    INSERT INTO users (phone_e164_norm, is_verified, kyc_verified, kyc_provider, kyc_checked_at, birth_date, age, created_at)
    VALUES ($1, TRUE, TRUE, $2, NOW(), to_date($3,'YYYYMMDD'), EXTRACT(YEAR FROM AGE(to_date($3,'YYYYMMDD'))), NOW())
    RETURNING id
  `, [normalizedPhone, input.kycProvider, input.birth]);
    const id = rows[0].id;
    // Store consents (simple log table already exists in repo)
    await (0, db_1.query)(`
    INSERT INTO terms_agreement_logs (user_id, tos, privacy, marketing, created_at)
    VALUES ($1::uuid, $2, $3, $4, NOW())
  `, [id, input.consent.tos, input.consent.privacy, !!input.consent.marketing]);
    return id;
}
async function findByPhone(phone) {
    // 🚨 전화번호 E.164 정규화 적용
    const normalizedPhone = normalizePhoneE164(phone);
    console.log("[REGISTER check]", {
        raw: phone,
        normalized: normalizedPhone,
        query: `SELECT id FROM users WHERE phone_e164_norm = $1`,
    });
    const rows = await (0, db_1.query)(`SELECT id FROM users WHERE phone_e164_norm = $1`, [
        normalizedPhone,
    ]);
    const exists = rows[0]?.id ?? null;
    console.log("[REGISTER exists check]", {
        normalizedPhone,
        exists,
        foundIds: rows.map((r) => r.id),
    });
    return exists;
}
