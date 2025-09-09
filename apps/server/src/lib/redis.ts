import Redis from "ioredis";

let client: Redis | null = null;

function makeRedis(): Redis {
  const url = process.env.REDIS_URL;
  if (url) {
    return new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      keepAlive: 30000,
    });
  }
  return new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    keepAlive: 30000,
  });
}

export function getRedis(): Redis {
  if (!client) {
    client = makeRedis();
    client.on("connect", () => console.log("🔌 Redis connecting..."));
    client.on("ready", () => console.log("✅ Redis ready"));
    client.on("error", (e) => console.error("❌ Redis error:", e?.message || e));
    client.on("end", () => console.warn("⚠️ Redis connection ended"));
  }
  
  // 연결 상태 확인 및 강제 연결
  if (!client.status || client.status === 'end') {
    console.log("🔄 Redis 재연결 시도...");
    client.connect();
  }
  
  return client;
}

// Redis 클라이언트 강제 재초기화
export function resetRedis() {
  if (client) {
    client.disconnect();
    client = null;
  }
  console.log("🔄 Redis client reset");
}

export async function assertRedisReady() {
  const r = getRedis();
  const pong = await r.ping();
  if (pong !== "PONG") throw new Error("Redis ping failed");
}

// 기존 코드와의 호환성을 위한 export
export const redis = getRedis();
export async function ensureRedis() {
  return getRedis();
}
export async function closeRedis() {
  if (client && client.status === "ready") {
    await client.quit();
  }
  client = null;
}