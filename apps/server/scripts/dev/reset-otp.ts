import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { getRedis } from "../../src/lib/redis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

async function scanAndDelete(pattern: string, redis: ReturnType<typeof getRedis>) {
  const keys: string[] = [];
  let cursor = "0";

  do {
    const [nextCursor, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");

  if (!keys.length) {
    console.log(`🟢 ${pattern} — No keys found`);
    return;
  }

  console.log(`🧹 ${pattern} — Deleting ${keys.length} keys`);
  await redis.del(...keys);
}

async function main() {
  const redis = getRedis();
  try {
    await scanAndDelete("otp:*", redis);
    await scanAndDelete("otp:cooldown:*", redis);
    await scanAndDelete("cooldown:send:phone:*", redis);
    await scanAndDelete("reg:ticket:*", redis);
    await scanAndDelete("signup:*", redis);
    console.log("✅ OTP / cooldown keys have been cleared for development.");
  } catch (error) {
    console.error("❌ Failed to reset OTP keys", error);
    process.exitCode = 1;
  } finally {
    redis.disconnect();
  }
}

void main();

