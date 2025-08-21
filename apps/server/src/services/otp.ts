import crypto from "crypto";
import { redis } from "../lib/redis";

export const genCode = () => (""+Math.floor(100000+Math.random()*900000));
export const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

const WINDOW_SEC = 10 * 60;   // 10분
const LIMIT_PER_PHONE = 5;
const LIMIT_PER_IP    = 20;

export async function canSend(phone: string, ip: string) {
  const kPhone = `rl:otp:phone:${phone}`;
  const kIP    = `rl:otp:ip:${ip}`;
  const p = redis.multi()
    .incr(kPhone).expire(kPhone, WINDOW_SEC)
    .incr(kIP).expire(kIP, WINDOW_SEC);
  const res = await p.exec();
  
  // Redis multi exec 결과 타입 안전하게 처리
  if (!res) return false;
  
  const phoneCount = Number(res[0] ?? 0);
  const ipCount = Number(res[2] ?? 0);
  
  return phoneCount <= LIMIT_PER_PHONE && ipCount <= LIMIT_PER_IP;
}
