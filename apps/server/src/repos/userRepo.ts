import { query } from "../db";

/**
 * ✅ 동시요청에도 안전한 UPSERT 버전
 *   - users(phone_e164_norm)에는 UNIQUE 인덱스가 있어야 합니다.
 *     CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone ON users(phone_e164_norm);
 */
export async function findOrCreateUserByPhoneE164(phoneE164: string) {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO users (phone_e164_norm, created_at, updated_at)
    VALUES ($1::text, NOW(), NOW())
    ON CONFLICT (phone_e164_norm) DO UPDATE
    SET updated_at = NOW()
    RETURNING id
    `,
    [phoneE164]
  );
  // 대부분 1행이 반환됩니다. (충돌 시에도 RETURNING id 보장)
  // phone_enc는 트리거가 자동으로 처리
  return rows[0].id;
}

/**
 * ✅ 프로필을 프런트 친화적 camelCase로 alias
 * 실제 users 테이블 스키마에 맞춤
 */
export async function getUserProfile(userId: string) {
  const rows = await query<{
    id: string;
    phone: string;
    nickname: string | null;
    isVerified: boolean;
    kycProvider: string | null;
    kycVerified: boolean;
    kycCheckedAt: string | null;
    birthDate: string | null;
    age: number | null;
    createdAt: string;
    updatedAt: string;
  }>(
    `
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
      created_at            AS "createdAt",
      updated_at            AS "updatedAt"
    FROM users
    WHERE id = $1::uuid
    `,
    [userId]
  );
  return rows[0] ?? null;
}

/** 마지막 로그인 시각만 갱신 */
export async function touchLastLogin(userId: string) {
  await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1::uuid`, [userId]);
}

/** 닉네임 업데이트 (존재 보장 위해 RETURNING) */
export async function updateUserNickname(userId: string, nickname: string | null) {
  const rows = await query<{ id: string }>(
    `UPDATE users SET nickname = $2, updated_at = NOW() WHERE id = $1::uuid RETURNING id`,
    [userId, nickname]
  );
  return rows.length > 0;
}

export async function updateKycStatus(userId: string, provider: string) {
  await query(
    `UPDATE users
       SET kyc_verified = TRUE,
           kyc_provider = $1,
           kyc_checked_at = NOW()
     WHERE id = $2::uuid`,
    [provider, userId]
  );
}

export async function findByPhone(phone: string) {
  const rows = await query<{ id: string }>(
    `SELECT id FROM users WHERE phone_e164_norm = $1`,
    [phone]
  );
  return rows[0] ?? null;
}