import { createClient } from "redis";

const url = process.env.REDIS_URL || "redis://localhost:6379";
export const redis = createClient({ url });

redis.on("error", (e: Error) => console.error("[redis]", e));

export async function ensureRedis() {
  if (!redis.isOpen) await redis.connect();
}
