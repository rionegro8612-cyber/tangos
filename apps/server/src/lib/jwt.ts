// apps/server/src/lib/jwt.ts
import jwt from "jsonwebtoken";
import crypto from "crypto";

/** 환경설정 */
const SECRET = process.env.JWT_SECRET || "dev_only_change_me";
const ACCESS_MIN = Number(process.env.JWT_ACCESS_EXPIRES_MIN || 30); // 30분
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30); // 30일

/** JWT Payload 타입 */
export interface JwtPayload {
  uid: string; // user id (UUID)
  jti: string; // unique token id
  iat?: number;
  exp?: number;
  iss?: string;
}

/** JTI 생성기 */
export function newJti(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** SHA-256 (RT 해시 저장용) */
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/** Access Token 발급 */
export function signAccessToken(uid: string, jti: string): string {
  const payload: JwtPayload = { uid, jti };
  return jwt.sign(payload, SECRET, {
    algorithm: "HS256",
    expiresIn: `${ACCESS_MIN}m`,
    issuer: "tango",
  });
}

/** Refresh Token 발급 */
export function signRefreshToken(uid: string, jti: string): string {
  const payload: JwtPayload = { uid, jti };
  return jwt.sign(payload, SECRET, {
    algorithm: "HS256",
    expiresIn: `${REFRESH_DAYS}d`,
    issuer: "tango",
  });
}

/** Access Token 검증 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}

/** Refresh Token 검증 */
export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}

/** ───── 호환성 alias (기존 코드가 참조해도 깨지지 않게) ───── */
export const signAccess = signAccessToken;
export const verifyToken = verifyAccessToken;

/** 공용 토큰 검증 함수 (숫자/UUID 모두 허용, 같은 시크릿) */
export function verifyAccessTokenOrThrow(token: string) {
  const p = jwt.verify(token, SECRET) as any; // ← **같은 시크릿**
  const uid = String(p?.uid ?? p?.sub ?? "");
  if (!isUuidOrInt(uid)) throw new Error("invalid uid");
  return { uid };
}

/** UUID 또는 정수형 ID 검증 */
export function isUuidOrInt(v: string): boolean {
  // 정수형 ID 검증: 1자리 이상의 숫자
  if (/^\d+$/.test(v)) return true;
  // UUID 검증
  return /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v);
}
