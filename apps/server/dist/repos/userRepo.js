"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOrCreateUserByPhoneE164 = findOrCreateUserByPhoneE164;
exports.getUserProfile = getUserProfile;
exports.touchLastLogin = touchLastLogin;
exports.updateUserNickname = updateUserNickname;
exports.updateKycStatus = updateKycStatus;
exports.findByPhone = findByPhone;
const db_1 = require("../db");
/**
 * ✅ 동시요청에도 안전한 UPSERT 버전
 *   - users(phone_e164_norm)에는 UNIQUE 인덱스가 있어야 합니다.
 *     CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone ON users(phone_e164_norm);
 */
async function findOrCreateUserByPhoneE164(phoneE164) {
    const rows = await (0, db_1.query)(`
    INSERT INTO users (phone_e164_norm, created_at)
    VALUES ($1::text, NOW())
    ON CONFLICT (phone_e164_norm) DO UPDATE
    SET created_at = NOW()
    RETURNING id
    `, [phoneE164]);
    // 대부분 1행이 반환됩니다. (충돌 시에도 RETURNING id 보장)
    // phone_enc는 트리거가 자동으로 처리
    return rows[0].id;
}
/**
 * ✅ 프로필을 프런트 친화적 camelCase로 alias
 * 실제 users 테이블 스키마에 맞춤
 */
async function getUserProfile(userId) {
    const rows = await (0, db_1.query)(`
    SELECT
      id,
      phone_e164_norm        AS phone,
      nickname               AS nickname,
      is_verified            AS "isVerified",
      kyc_provider          AS "kycProvider",
      kyc_verified          AS "kycVerified",
      kyc_checked_at        AS "kycCheckedAt",
      birth_date            AS "birthDate",
      age                   AS age,
      created_at            AS "createdAt"
    FROM users
    WHERE id = $1::integer
    `, [userId]);
    return rows[0] ?? null;
}
/** 마지막 로그인 시각만 갱신 */
async function touchLastLogin(userId) {
    await (0, db_1.query)(`UPDATE users SET last_login_at = NOW() WHERE id = $1::integer`, [userId]);
}
/** 닉네임 업데이트 (존재 보장 위해 RETURNING) */
async function updateUserNickname(userId, nickname) {
    const rows = await (0, db_1.query)(`UPDATE users SET nickname = $2 WHERE id = $1::integer RETURNING id`, [userId, nickname]);
    return rows.length > 0;
}
async function updateKycStatus(userId, provider) {
    await (0, db_1.query)(`UPDATE users
       SET kyc_verified = TRUE,
           kyc_provider = $1,
           kyc_checked_at = NOW()
     WHERE id = $2::integer`, [provider, userId]);
}
async function findByPhone(phone) {
    const rows = await (0, db_1.query)(`SELECT id FROM users WHERE phone_e164_norm = $1`, [
        phone,
    ]);
    return rows[0] ?? null;
}
