// src/server/auth/sms/repo.ts
import 'server-only';
import { query } from "@/server/db";

type SmsCodeRow = {
  id: string;
  code_hash: string;
  code_salt: string;
  expires_at: string; // 필요하면 Date로 변경
  attempts: number;
};

export async function findLatestActiveCodeRow(phoneE164: string, purpose: string) {
  const sql = `
    SELECT id, code_hash, code_salt, expires_at, attempts
    FROM auth_sms_codes
    WHERE phone_e164_norm = $1
      AND purpose = $2
      AND verified_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const rows = await query<SmsCodeRow>(sql, [phoneE164, purpose]);
  return rows[0];
}

export async function insertCode(params: {
  phoneE164: string;
  codeHash: string;
  codeSalt: string;
  purpose: string;
  ttlMin: number;
  traceId?: string;
}) {
  const sql = `
    INSERT INTO auth_sms_codes
      (phone_e164_norm, code_hash, code_salt, purpose, expires_at, trace_id)
    VALUES
      ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval, $6)
    RETURNING id, expires_at;
  `;
  type InsertReturn = { id: string; expires_at: string };
  const rows = await query<InsertReturn>(sql, [
    params.phoneE164,
    params.codeHash,
    params.codeSalt,
    params.purpose,
    params.ttlMin,
    params.traceId ?? null,
  ]);
  return rows[0];
}

export async function incrementAttempts(id: string) {
  await query(`UPDATE auth_sms_codes SET attempts = attempts + 1 WHERE id = $1;`, [id]);
}

export async function markVerified(id: string) {
  await query(`UPDATE auth_sms_codes SET verified_at = NOW() WHERE id = $1;`, [id]);
}

export async function countSentInWindow(phoneE164: string, purpose: string, windowSec: number) {
  const sql = `
    SELECT COUNT(1) AS cnt
    FROM auth_sms_codes
    WHERE phone_e164_norm = $1
      AND purpose = $2
      AND created_at > NOW() - ($3 || ' seconds')::interval;
  `;
  type CountRow = { cnt: string };
  const rows = await query<CountRow>(sql, [phoneE164, purpose, windowSec]);
  return Number(rows[0]?.cnt ?? 0);
}
