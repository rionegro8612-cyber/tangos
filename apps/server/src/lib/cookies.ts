// apps/server/src/lib/cookies.ts
import type { CookieOptions } from "express";

const cookieName = "tango_at"; // Access Token 쿠키 이름
export const COOKIE_NAME = cookieName;

export function accessCookieOptions(): CookieOptions {
  const secure = String(process.env.COOKIE_SECURE || "false") === "true";
  const domain = process.env.COOKIE_DOMAIN || undefined;
  const maxAgeMin = Number(process.env.JWT_ACCESS_EXPIRES_MIN || 30);
  return {
    httpOnly: true,
    secure,                          // 로컬 HTTP면 false, 배포면 true
    sameSite: secure ? "none" : "lax",
    domain,                          // 필요 없으면 undefined 유지
    path: "/",
    maxAge: maxAgeMin * 60 * 1000,
  };
}
