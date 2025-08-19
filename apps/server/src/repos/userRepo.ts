import { query } from "../db";

/**
 * ✅ 동시요청에도 안전한 UPSERT 버전
 *   - users(phone_e164_norm)에는 UNIQUE 인덱스가 있어야 합니다.
 *     CREATE UNIQUE INDEX IF NOT EXISTS ux_users_phone ON users(phone_e164_norm);
 */
export async function findOrCreateUserByPhoneE164(phoneE164: string) {
  const rows = await query<{ id: number }>(
    `
    INSERT INTO users (phone_e164_norm, created_at)
    VALUES ($1, NOW())
    ON CONFLICT (phone_e164_norm)
    DO UPDATE SET phone_e164_norm = EXCLUDED.phone_e164_norm
    RETURNING id
    `,
    [phoneE164]
  );
  // 대부분 1행이 반환됩니다. (충돌 시에도 RETURNING id 보장)
  return rows[0].id;
}

/**
 * ✅ 프로필을 프런트 친화적 camelCase로 alias
 * 필요 시 KYC 필드도 함께 반환
 */
export async function getUserProfile(userId: number) {
  const rows = await query<{
    id: number;
    phone: string;
    nickname: string | null;
    isKycVerified: boolean;
    kycVerifiedAt: string | null;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string | null;
  }>(
    `
    SELECT
      id,
      phone_e164_norm        AS phone,
      nickname               AS nickname,
      COALESCE(is_kyc_verified, FALSE) AS "isKycVerified",
      kyc_verified_at        AS "kycVerifiedAt",
      last_login_at          AS "lastLoginAt",
      created_at             AS "createdAt",
      updated_at             AS "updatedAt"
    FROM users
    WHERE id = $1
    `,
    [userId]
  );
  return rows[0] ?? null;
}

/** 마지막 로그인 시각만 갱신 */
export async function touchLastLogin(userId: number) {
  await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [userId]);
}

/** 닉네임 업데이트 (존재 보장 위해 RETURNING) */
export async function updateUserNickname(userId: number, nickname: string | null) {
  const rows = await query<{ id: number }>(
    `UPDATE users SET nickname = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [userId, nickname]
  );
  return rows.length > 0;
}
