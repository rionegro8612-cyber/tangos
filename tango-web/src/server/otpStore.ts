// 간단한 메모리 저장소 (MVP): 실서비스는 Redis 권장
type OtpRecord = {
    code: string;
    expiresAt: number;
    attempts: number;
    lockedUntil?: number;
    lastSentAt?: number;
  };
  
  const store = new Map<string, OtpRecord>();
  
  const SEC = 1000;
  const MIN = 60 * SEC;
  
  const TTL_SEC = Number(process.env.OTP_CODE_TTL_SEC ?? 180);
  const RESEND_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SEC ?? 60);
  const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
  const LOCK_MIN = Number(process.env.OTP_LOCK_MINUTES ?? 10);
  
  export function canSend(phone: string) {
    const now = Date.now();
    const rec = store.get(phone);
    if (!rec) return { ok: true, waitMs: 0 };
    const waitMs = (rec.lastSentAt ?? 0) + RESEND_COOLDOWN_SEC * SEC - now;
    return { ok: waitMs <= 0, waitMs: Math.max(0, waitMs) };
  }
  
  export function putCode(phone: string, code: string) {
    const now = Date.now();
    const rec: OtpRecord = {
      code,
      expiresAt: now + TTL_SEC * SEC,
      attempts: 0,
      lastSentAt: now,
    };
    store.set(phone, rec);
    return rec;
  }
  
  export function getRecord(phone: string) {
    return store.get(phone);
  }
  
  export function incAttempt(phone: string) {
    const rec = store.get(phone);
    if (!rec) return 0;
    rec.attempts += 1;
    if (rec.attempts >= MAX_ATTEMPTS) {
      rec.lockedUntil = Date.now() + LOCK_MIN * MIN;
    }
    return rec.attempts;
  }
  
  export function clear(phone: string) {
    store.delete(phone);
  }
  
  export function isLocked(phone: string) {
    const rec = store.get(phone);
    if (!rec || !rec.lockedUntil) return false;
    if (Date.now() < rec.lockedUntil) return true;
    delete rec.lockedUntil;
    rec.attempts = 0;
    return false;
  }
  
  export function getConstants() {
    return { TTL_SEC, RESEND_COOLDOWN_SEC, MAX_ATTEMPTS, LOCK_MIN };
  }
  