// src/lib/redis.ts
import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let connecting: Promise<void> | null = null;

export function getRedis(): RedisClientType {
  if (client) return client;

  const url = process.env.REDIS_URL || 'redis://redis:6379/0';
  const prefix = process.env.REDIS_PREFIX || '';

  client = createClient({
    url,
    socket: {
      reconnectStrategy(retries) {
        if (retries > 20) return new Error('Redis reconnect failed');
        return Math.min(100 * retries, 2000); // 100ms → 2s
      },
    },
    // @ts-ignore - type에는 없지만 v4는 keyPrefix 옵션 지원 안 함
    // prefix는 키 생성 함수에서 수동으로 처리합니다.
  });

  client.on('error', (err) => console.error('[REDIS] error', err?.message));
  client.on('end', () => console.warn('[REDIS] end(disconnected)'));
  client.on('ready', () => console.info('[REDIS] ready', { url }));
  client.on('reconnecting', () => console.warn('[REDIS] reconnecting...'));

  connecting = client.connect().then(() => { connecting = null; });

  const shutdown = async () => {
    try { await client?.quit(); } catch {}
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return client;
}

export async function ensureRedisReady() {
  const c = getRedis();
  if (connecting) await connecting;
  if (!(c as any).isOpen) await c.connect();
  return c;
}

// 공통 키 생성기 (prefix 적용)
export const withPrefix = (key: string) => {
  const p = process.env.REDIS_PREFIX || '';
  return p ? `${p}${key}` : key;
};














