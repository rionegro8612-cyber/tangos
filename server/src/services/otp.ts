// src/services/otp.ts
import { ensureRedisReady, withPrefix } from '../lib/redis';

const OTP_TTL_SEC = Number(process.env.OTP_TTL_SEC || 300);

const normalizePhone = (p: string) => {
  // 프로젝트 규칙에 맞게 조정(E.164 권장)
  let s = decodeURIComponent(p).trim();
  s = s.replace(/\s|-/g, '');
  if (!s.startsWith('+')) s = '+' + s;
  return s;
};

const otpKey = (ctx: string, phone: string) =>
  withPrefix(`otp:${ctx}:${normalizePhone(phone)}`);

export async function storeOtp(ctx: string, phone: string, code: string) {
  const r = await ensureRedisReady();
  const key = otpKey(ctx, phone);
  try {
    await r.set(key, JSON.stringify({ code, ts: Date.now() }), { EX: OTP_TTL_SEC });
    const ttl = await r.ttl(key);
    console.info('[OTP:SET]', { key, ttl });
    return { ok: true as const };
  } catch (e) {
    console.error('[OTP:SET:ERR]', { key, err: String(e) });
    return { ok: false as const, code: 'STORE_FAILED' as const };
  }
}

export async function fetchOtp(ctx: string, phone: string) {
  const r = await ensureRedisReady();
  const key = otpKey(ctx, phone);
  try {
    const raw = await r.get(key);
    const ttl = await r.ttl(key);
    console.info('[OTP:GET]', { key, ttl, exists: !!raw });
    if (!raw || ttl <= 0) return { ok: false as const, code: 'EXPIRED_OR_NOT_FOUND' as const };
    const val = JSON.parse(raw) as { code: string; ts: number };
    return { ok: true as const, val, ttl };
  } catch (e) {
    console.error('[OTP:GET:ERR]', { key, err: String(e) });
    return { ok: false as const, code: 'STORE_UNAVAILABLE' as const };
  }
}

export async function consumeOtp(ctx: string, phone: string) {
  const r = await ensureRedisReady();
  const key = otpKey(ctx, phone);
  try {
    const res = await r.del(key);
    console.info('[OTP:DEL]', { key, deleted: res });
  } catch (e) {
    console.error('[OTP:DEL:ERR]', { key, err: String(e) });
  }
}








