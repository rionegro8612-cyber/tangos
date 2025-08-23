import { redis } from "./redis";

export async function setExStr(key: string, seconds: number, value: unknown) {
  const v = typeof value === "string" ? value : JSON.stringify(value);
  return redis.setEx(key, seconds, v); // node-redis v4: value는 string 이어야 함
}

export async function setStr(key: string, value: unknown) {
  const v = typeof value === "string" ? value : JSON.stringify(value);
  return redis.set(key, v);
}
