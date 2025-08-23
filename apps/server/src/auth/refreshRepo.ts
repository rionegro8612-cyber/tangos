import crypto from "crypto";
import { query } from "../db";

const sha256hex = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function storeRefresh(
  userId: string,
  token: string,
  expiresAtISO: string,
  ua?: string,
  ip?: string
) {
  // 임시로 테이블이 없으므로 로그만 출력
  console.log('[AUTH_REFRESH] 저장 시도:', { userId, expiresAtISO, ua, ip });
  // TODO: auth_refresh_tokens 테이블 생성 후 활성화
  // const hash = sha256hex(token);
  // await query(
  //   `INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_addr)
  //    VALUES ($1::uuid, $2, $3, $4, $5)`,
  //   [userId, hash, expiresAtISO, ua ?? null, ip ?? null]
  // );
}

export async function revokeRefresh(token: string) {
  // 임시로 테이블이 없으므로 로그만 출력
  console.log('[AUTH_REFRESH] 폐기 시도:', { token: token.substring(0, 10) + '...' });
  // TODO: auth_refresh_tokens 테이블 생성 후 활성화
  // const hash = sha256hex(token);
  // await query(
  //   `UPDATE auth_refresh_tokens
  //      SET revoked_at = NOW()
  //    WHERE token_hash = $1
  //      AND revoked_at IS NULL`,
  //   [hash]
  // );
}

export async function isRefreshValid(userId: string, token: string): Promise<boolean> {
  // 임시로 테이블이 없으므로 false 반환
  console.log('[AUTH_REFRESH] 유효성 검사 시도:', { userId, token: token.substring(0, 10) + '...' });
  return false;
  // TODO: auth_refresh_tokens 테이블 생성 후 활성화
  // const hash = sha256hex(token);
  // const rows = await query<{ id: string }>(
  //   `SELECT id FROM auth_refresh_tokens
  //     WHERE user_id = $1::uuid
  //       AND token_hash = $2
  //       AND revoked_at IS NULL
  //       AND expires_at > NOW()
  //     LIMIT 1`,
  //   [userId, hash]
  // );
  // return !!rows[0];
}

export async function replaceRefresh(
  userId: string,
  oldToken: string,
  newToken: string,
  expIso: string,
  userAgent: string | null,
  ip: string | null
): Promise<boolean> {
  // 임시로 테이블이 없으므로 로그만 출력하고 true 반환
  console.log('[AUTH_REFRESH] 교체 시도:', { userId, expIso, userAgent, ip });
  return true;
  // TODO: auth_refresh_tokens 테이블 생성 후 활성화
  // const oldHash = sha256hex(oldToken);
  // const newHash = sha256hex(newToken);

  // // 1) 기존 refresh 토큰 폐기
  // await query(
  //   `UPDATE auth_refresh_tokens
  //       SET revoked_at = NOW()
  //     WHERE user_id = $1::uuid
  //       AND token_hash = $2
  //       AND revoked_at IS NULL`,
  //   [userId, oldHash]
  // );

  // // 2) 새 refresh 토큰 저장
  // await query(
  //   `INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_addr)
  //    VALUES ($1::uuid, $2, $3, $4, $5)`,
  //   [userId, newHash, expIso, userAgent, ip]
  // );

  // return true;
}
