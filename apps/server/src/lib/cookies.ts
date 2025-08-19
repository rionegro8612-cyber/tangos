import type { CookieOptions } from "express";

export const COOKIE_NAME = "tango_at";

export function accessCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? true : false; // dev는 false
  const sameSite = isProd ? "none" : "lax";
  return {
    httpOnly: true,
    secure,
    sameSite: sameSite as any,
    path: "/",
    maxAge: 60 * 60 * 24 * 7 * 1000, // 7d
  };
}
