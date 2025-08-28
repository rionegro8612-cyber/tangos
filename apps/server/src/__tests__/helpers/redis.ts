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
    'otp:',
    'otp:cooldown:',
    'rate:',
    'idem:',
    'cooldown:'
  ];
  
  for (const prefix of prefixes) {
    await purgeKeys(prefix);
  }
}

export async function setTestOtp(phone: string, code: string, ttl: number = 300) {
  try {
    const r = await ensureRedis();
    await r.setEx(`otp:${phone}`, ttl, code);
    console.log(`[TEST] Test OTP set: ${phone} -> ${code} (TTL: ${ttl}s)`);
  } catch (error) {
    console.error(`[TEST] Failed to set test OTP: ${phone}`, error);
  }
}
