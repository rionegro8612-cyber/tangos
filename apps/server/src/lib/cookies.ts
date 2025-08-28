// apps/server/src/lib/cookies.ts
import type { CookieOptions, Response } from "express";

/**
 * 현재 운영 이름
 * - access_token / refresh_token: 신규 표준
 * - COOKIE_NAME(tango_at): 과거 호환(읽기 폴백용)
 */
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
export const COOKIE_NAME = "tango_at"; // legacy alias(과거 명칭)

/** 환경 분기 */
const isProd = process.env.NODE_ENV === "production";

/** (선택) 프로덕션 도메인 지정: 예) COOKIE_DOMAIN=.tango.app */
function getCookieDomain(): string | undefined {
  const d = process.env.COOKIE_DOMAIN?.trim();
  if (!d) return undefined;
  // 안전: prod 에서만 domain 부여
  return isProd ? d : undefined;
}

/** 공통 기본 옵션 */
function baseCookieOptions(maxAgeMs: number): CookieOptions {
  const secure = process.env.COOKIE_SECURE === "true" || isProd;
  const sameSite = process.env.COOKIE_SAMESITE?.toLowerCase() || (isProd ? "none" : "lax");

  // 프로덕션에서 SameSite=none일 때 secure=true 필수
  if (sameSite === "none" && !secure) {
    console.warn("[COOKIE] SameSite=none requires secure=true, falling back to lax");
    return {
      httpOnly: true,
      secure: false,
      sameSite: "lax" as any,
      path: "/",
      maxAge: maxAgeMs,
      domain: getCookieDomain(),
    };
  }

  return {
    httpOnly: true,
    secure,
    sameSite: sameSite as any,
    path: "/",
    maxAge: maxAgeMs,
    domain: getCookieDomain(),
  };
}

/** Access/Refresh 개별 옵션 */
export function accessCookieOptions(): CookieOptions {
  // 30분(기본) — 필요 시 .env: JWT_ACCESS_EXPIRES_MIN 으로 맞춰도 됨
  const minutes = Number(process.env.JWT_ACCESS_EXPIRES_MIN || 30);
  return baseCookieOptions(minutes * 60 * 1000);
}

export function refreshCookieOptions(): CookieOptions {
  // 30일(기본)
  const days = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30);
  return baseCookieOptions(days * 24 * 60 * 60 * 1000);
}

/** 세션 쿠키 발급(set) */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions());
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}

/** 세션 쿠키 제거(clear) */
export function clearAuthCookies(res: Response) {
  const opt: CookieOptions = { path: "/", domain: getCookieDomain() };
  res.clearCookie(ACCESS_COOKIE, opt);
  res.clearCookie(REFRESH_COOKIE, opt);
  // 혹시 남아있을 수 있는 레거시 쿠키도 같이 제거
  res.clearCookie(COOKIE_NAME, opt);
}

/**
 * 쿠키에서 액세스 토큰 읽기(우선순위: access_token → tango_at(레거시))
 *  - req.cookies 를 그대로 넣어서 사용하세요.
 */
export function getAccessTokenFromCookies(
  cookies: Record<string, any> | undefined,
): string | undefined {
  if (!cookies) return undefined;
  return (
    (cookies[ACCESS_COOKIE] as string | undefined) || (cookies[COOKIE_NAME] as string | undefined)
  );
}
