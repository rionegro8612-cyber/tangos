
import { query } from "../db";

/** Upsert active session keyed by phone */
export async function upsertActiveSession(phone: string, carrier: string, ttlSec: number) {
  const expiresAtSql = `NOW() + INTERVAL '${ttlSec} seconds'`;
  await query(`
    INSERT INTO signup_sessions (phone_e164_norm, carrier, phone_verified, purpose, expires_at, created_at, updated_at)
    VALUES ($1, $2, FALSE, 'register', ${expiresAtSql}, NOW(), NOW())
    ON CONFLICT (phone_e164_norm)
    DO UPDATE SET carrier = EXCLUDED.carrier, expires_at = ${expiresAtSql}, updated_at = NOW()
  `, [phone, carrier]);
}

export async function markPhoneVerified(phone: string) {
  await query(
    `UPDATE signup_sessions SET phone_verified = TRUE, updated_at = NOW() WHERE phone_e164_norm = $1`,
    [phone]
  );
}

export async function findActiveByPhone(phone: string) {
  const rows = await query<any>(
    `SELECT * FROM signup_sessions WHERE phone_e164_norm = $1 AND expires_at > NOW()`,
    [phone]
  );
  return rows[0] ?? null;
}

export async function completeAndDelete(phone: string) {
  await query(`DELETE FROM signup_sessions WHERE phone_e164_norm = $1`, [phone]);
}
