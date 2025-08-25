import { findLatestActiveCodeRow, insertCode, incrementAttempts, markVerified, countSentInWindow } from "./repo";
import { normalizeE164, generate6DigitCode, randomSalt, hashCode } from "./utils";

const TTL_MIN = Number(process.env.OTP_TTL_MINUTES ?? 5);
const RATE_PER_MIN = Number(process.env.OTP_RATE_LIMIT_PER_MIN ?? 3);
const VERIFY_MAX = Number(process.env.OTP_VERIFY_MAX_ATTEMPTS ?? 5);

export async function requestCode(rawPhone: string, purpose = "login") {
  const phoneE164 = normalizeE164(rawPhone);

  // 1분 창에서 전송 횟수 제한
  const sent = await countSentInWindow(phoneE164, purpose, 60);
  if (sent >= RATE_PER_MIN) {
    return { ok: false as const, reason: "RATE_LIMIT" as const, retryAfterSec: 60 };
  }

  const code = generate6DigitCode();
  const salt = randomSalt(16);
  const cHash = hashCode(code, salt);
  const row = await insertCode({ phoneE164, codeHash: cHash, codeSalt: salt, purpose, ttlMin: TTL_MIN });

  // 실제 SMS 연동 대신 콘솔 출력 (개발용)
  console.log(`[SMS][DEV] ${phoneE164} → [탱고] 인증코드: ${code} (${TTL_MIN}분 유효)`);

  if (!row) {
    return { ok: false as const, reason: "INSERT_FAILED" as const };
  }

  const ttlSec = Math.max(1, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000));
  return { ok: true as const, phoneE164, expiresInSec: ttlSec };
}

export async function verifyCode(rawPhone: string, purpose: string, code: string) {
  const phoneE164 = normalizeE164(rawPhone);
  const row = await findLatestActiveCodeRow(phoneE164, purpose);
  if (!row) return { ok: false as const, reason: "NO_ACTIVE_CODE" as const };

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false as const, reason: "EXPIRED" as const };
  }

  const rehash = hashCode(code, row.code_salt);
  if (rehash !== row.code_hash) {
    await incrementAttempts(row.id);
    if ((row.attempts + 1) >= VERIFY_MAX) {
      return { ok: false as const, reason: "LOCKED" as const };
    }
    return { ok: false as const, reason: "MISMATCH" as const };
  }

  await markVerified(row.id);
  return { ok: true as const };
}