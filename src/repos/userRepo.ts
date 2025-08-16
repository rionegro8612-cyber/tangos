import { query } from "../db";

export async function findOrCreateUserByPhoneE164(phoneE164: string) {
  const rows = await query<{ id: number }>(`SELECT id FROM users WHERE phone_e164_norm = $1`, [phoneE164]);
  if (rows[0]) return rows[0].id;
  const ins = await query<{ id: number }>(
    `INSERT INTO users (phone_e164_norm, created_at) VALUES ($1, NOW()) RETURNING id`,
    [phoneE164]
  );
  return ins[0].id;
}

export async function getUserProfile(userId: number) {
  const rows = await query<{ id: number; phone_e164_norm: string; nickname: string | null; last_login_at: string | null; created_at: string }>(
    `SELECT id, phone_e164_norm, nickname, last_login_at, created_at FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

export async function touchLastLogin(userId: number) {
  await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [userId]);
}
