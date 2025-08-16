import { query } from "../../db";
import { e164, hashCode, newSalt } from "./otpUtil";

type CodeRow = {
  id: number;
  request_id: string;
  phone_e164_norm: string;
  code_hash: string;
  expire_at: string;
  used_at: string | null;
  attempt_count: number;
  created_at: string;
};

export async function issueCode(rawPhone: string) {
  const phone = e164(rawPhone);
  // 최근 발송 이력 조회 (쿨다운)
  const recent = await query<{ created_at: string }>(
    `SELECT created_at FROM auth_sms_codes
     WHERE phone_e164_norm = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone]
  );
  const last = recent[0]?.created_at ? new Date(recent[0].created_at).getTime() : 0;
  const now = Date.now();
  const cooldownMs = Number(process.env.OTP_RESEND_COOLDOWN_SEC ?? 60) * 1000;
  if (last && now - last < cooldownMs) {
    const left = Math.ceil((cooldownMs - (now - last)) / 1000);
    return { ok: false, code: "RESEND_COOLDOWN", message: "resend cooldown", retryAfterSec: left };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const salt = newSalt();
  const hash = hashCode(code, salt);
  const ttlSec = Number(process.env.OTP_CODE_TTL_SEC ?? 180);

  const rows = await query<{ id: number; request_id: string; expire_at: string }>(
    `INSERT INTO auth_sms_codes (request_id, phone_e164_norm, code_hash, expire_at)
     VALUES (gen_random_uuid(), $1, $2, NOW() + ($3 || ' seconds')::interval)
     RETURNING id, request_id, expire_at`,
    [phone, hash + ":" + salt, String(ttlSec)]
  );
  const row = rows[0];
  return { ok: true, phoneE164: phone, requestId: row.request_id, expiresInSec: ttlSec, _codeForDev: code };
}

export async function verifyCode(rawPhone: string, code: string) {
  const phone = e164(rawPhone);
  const rows = await query<CodeRow>(
    `SELECT id, request_id, phone_e164_norm, code_hash, expire_at, used_at, attempt_count, created_at
     FROM auth_sms_codes
     WHERE phone_e164_norm = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone]
  );
  const rec = rows[0];
  if (!rec) return { ok: false, code: "NO_CODE", message: "no code issued" };

  const exp = new Date(rec.expire_at).getTime();
  if (Date.now() > exp) return { ok: false, code: "EXPIRED", message: "code expired" };

  if (rec.used_at) return { ok: false, code: "ALREADY_USED", message: "code already used" };

  const [storedHash, salt] = rec.code_hash.split(":");
  const calc = hashCode(code, salt);
  if (calc !== storedHash) {
    await query(`UPDATE auth_sms_codes SET attempt_count = attempt_count + 1 WHERE id = $1`, [rec.id]);
    return { ok: false, code: "INVALID_CODE", message: "invalid code" };
  }

  await query(`UPDATE auth_sms_codes SET used_at = NOW() WHERE id = $1`, [rec.id]);
  return { ok: true, phoneE164: phone };
}
