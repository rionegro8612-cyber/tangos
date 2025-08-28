import { createClient, RedisClientType } from "redis";

let client: RedisClientType | null = null;
let connecting: Promise<any> | null = null;

export function getRedis(): RedisClientType {
  if (client) return client;
  client = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
  client.on("error", (err) => console.error("[Redis] error:", err));
  return client;
}

export async function ensureRedis(): Promise<RedisClientType> {
  const c = getRedis();
  if (c.isOpen) return c;
  if (!connecting) {
    connecting = c.connect().then(() => {
      connecting = null;
    }).catch((e) => {
      connecting = null;
      throw e;
    });
  }
  await connecting;
  return c;
}

export async function closeRedis(): Promise<void> {
  if (client && client.isOpen) await client.quit();
  client = null;
  connecting = null;
}

// 기존 export 유지 (하위 호환성)
export const redis = getRedis();
