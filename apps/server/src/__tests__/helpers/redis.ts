import { ensureRedis } from '../../lib/redis';

export async function purgeKeys(prefix: string) {
  try {
    const r = await ensureRedis();
    const keys = await r.keys(`${prefix}*`);
    if (keys.length > 0) {
      await r.del(keys);
      console.log(`[TEST] Purged ${keys.length} keys with prefix: ${prefix}`);
    }
  } catch (error) {
    console.error(`[TEST] Failed to purge keys with prefix: ${prefix}`, error);
  }
}

export async function cleanupTestData() {
  const prefixes = [
    'otp:',  // 모든 OTP 관련 키 (otp:*:code 포함)
    'otp:cooldown:',  // OTP 쿨다운 키
    'rate:',  // 레이트 리미트 키
    'idem:',  // 멱등성 키
    'cooldown:'  // 일반 쿨다운 키
  ];
  
  for (const prefix of prefixes) {
    await purgeKeys(prefix);
  }
}

export async function setTestOtp(phone: string, code: string, ttl: number = 300) {
  try {
    const r = await ensureRedis();
    // 표준 키 구조 사용: otp:${phone}:code
    await r.setex(`otp:${phone}:code`, ttl, code);
    console.log(`[TEST] Test OTP set: ${phone} -> ${code} (TTL: ${ttl}s)`);
  } catch (error) {
    console.error(`[TEST] Failed to set test OTP: ${phone}`, error);
  }
}
