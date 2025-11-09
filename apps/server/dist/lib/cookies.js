"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COOKIE_NAME = exports.REFRESH_COOKIE = exports.ACCESS_COOKIE = void 0;
exports.accessCookieOptions = accessCookieOptions;
exports.refreshCookieOptions = refreshCookieOptions;
exports.setAuthCookies = setAuthCookies;
exports.clearAuthCookies = clearAuthCookies;
exports.getAccessTokenFromCookies = getAccessTokenFromCookies;
/**
 * 현재 운영 이름
 * - access_token / refresh_token: 신규 표준
 * - COOKIE_NAME(tango_at): 과거 호환(읽기 폴백용)
 */
exports.ACCESS_COOKIE = "access_token";
exports.REFRESH_COOKIE = "refresh_token";
exports.COOKIE_NAME = "tango_at"; // legacy alias(과거 명칭)
/** 환경 분기 */
const isProd = process.env.NODE_ENV === "production";
/** 쿠키 도메인 유효성 검사 및 해결 */
function resolveCookieDomain() {
    const v = process.env.COOKIE_DOMAIN?.trim();
    // 빈 값, 주석, 공백만 있는 경우
    if (!v || v === '' || v.startsWith('#') || v.startsWith('//')) {
        return undefined;
    }
    // 스킴 포함 (http://, https://)
    if (/^https?:\/\//i.test(v)) {
        console.warn("[COOKIE] Invalid domain (contains scheme):", v);
        return undefined;
    }
    // 포트 포함 (:3000, :8080 등)
    if (v.includes(":")) {
        console.warn("[COOKIE] Invalid domain (contains port):", v);
        return undefined;
    }
    // localhost 관련
    if (v === "localhost" || v.endsWith(".localhost")) {
        console.warn("[COOKIE] Invalid domain (localhost):", v);
        return undefined;
    }
    // IP 주소
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
        console.warn("[COOKIE] Invalid domain (IP address):", v);
        return undefined;
    }
    // 개발 환경에서는 절대 도메인 설정하지 않음
    if (!isProd) {
        console.log("[COOKIE] Development mode - domain disabled");
        return undefined;
    }
    // 유효한 도메인인 경우만 반환
    return v.replace(/^\./, "."); // 선호형식: 앞점 허용(서브도메인 전역)
}
/** 공통 기본 옵션 */
function baseCookieOptions(maxAgeMs) {
    const secure = process.env.COOKIE_SECURE === "true" || isProd;
    const sameSite = process.env.COOKIE_SAMESITE?.toLowerCase() || (isProd ? "none" : "lax");
    const cookieDomain = resolveCookieDomain();
    // 프로덕션에서 SameSite=none일 때 secure=true 필수
    if (sameSite === "none" && !secure) {
        console.warn("[COOKIE] SameSite=none requires secure=true, falling back to lax");
        return {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            path: "/",
            maxAge: maxAgeMs,
            ...(cookieDomain ? { domain: cookieDomain } : {}),
        };
    }
    const options = {
        httpOnly: true,
        secure,
        sameSite: sameSite,
        path: "/",
        maxAge: maxAgeMs,
        ...(cookieDomain ? { domain: cookieDomain } : {}),
    };
    return options;
}
/** Access/Refresh 개별 옵션 */
function accessCookieOptions() {
    // 30분(기본) — 필요 시 .env: JWT_ACCESS_EXPIRES_MIN 으로 맞춰도 됨
    const minutes = Number(process.env.JWT_ACCESS_EXPIRES_MIN || 30);
    return baseCookieOptions(minutes * 60 * 1000);
}
function refreshCookieOptions() {
    // 30일(기본)
    const days = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30);
    return baseCookieOptions(days * 24 * 60 * 60 * 1000);
}
/** 세션 쿠키 발급(set) */
function setAuthCookies(res, accessToken, refreshToken) {
    res.cookie(exports.ACCESS_COOKIE, accessToken, accessCookieOptions());
    res.cookie(exports.REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}
/** 세션 쿠키 제거(clear) */
function clearAuthCookies(res) {
    const opt = { path: "/" };
    const cookieDomain = resolveCookieDomain();
    if (cookieDomain) {
        opt.domain = cookieDomain;
    }
    res.clearCookie(exports.ACCESS_COOKIE, opt);
    res.clearCookie(exports.REFRESH_COOKIE, opt);
    // 혹시 남아있을 수 있는 레거시 쿠키도 같이 제거
    res.clearCookie(exports.COOKIE_NAME, opt);
}
/**
 * 쿠키에서 액세스 토큰 읽기(우선순위: access_token → tango_at(레거시))
 *  - req.cookies 를 그대로 넣어서 사용하세요.
 */
function getAccessTokenFromCookies(cookies) {
    if (!cookies)
        return undefined;
    return (cookies[exports.ACCESS_COOKIE] || cookies[exports.COOKIE_NAME]);
}
