import crypto from "crypto";
import { query } from "../db";

const sha256hex = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function storeRefresh(
  userId: string,
  token: string,
  expiresAtISO: string,
  ua?: string,
  ip?: string,
) {
  const hash = sha256hex(token);
  
  // 기존 활성 토큰이 있다면 폐기
  await query(
    `UPDATE auth_refresh_tokens 
     SET revoked_at = NOW() 
     WHERE user_id = $1::uuid AND revoked_at IS NULL`,
    [userId]
  );
  
  // 새 토큰 저장
  await query(
    `INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_addr)
     VALUES ($1::uuid, $2, $3, $4, $5)`,
    [userId, hash, expiresAtISO, ua ?? null, ip ?? null]
  );
}

export async function revokeRefresh(token: string) {
  const hash = sha256hex(token);
  await query(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hash]
  );
}

export async function isRefreshValid(userId: string, token: string): Promise<boolean> {
  const hash = sha256hex(token);
  const rows = await query<{ id: string }>(
    `SELECT id FROM auth_refresh_tokens
     WHERE user_id = $1::uuid
       AND token_hash = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [userId, hash]
  );
  return !!rows[0];
}

export async function replaceRefresh(
  userId: string,
  oldToken: string,
  newToken: string,
  expIso: string,
  userAgent: string | null,
  ip: string | null,
): Promise<boolean> {
  const oldHash = sha256hex(oldToken);
  const newHash = sha256hex(newToken);

  // 1) 기존 refresh 토큰 폐기
  await query(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1::uuid
       AND token_hash = $2
       AND revoked_at IS NULL`,
    [userId, oldHash]
  );

  // 2) 새 refresh 토큰 저장
  await query(
    `INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_addr)
     VALUES ($1::uuid, $2, $3, $4, $5)`,
    [userId, newHash, expIso, userAgent, ip]
  );

  return true;
}

// 추가: 사용자의 모든 활성 토큰 폐기 (로그아웃 시)
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1::uuid AND revoked_at IS NULL`,
    [userId]
  );
}

// 추가: 만료된 토큰 정리 (크론잡용)
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await query(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW()
     WHERE expires_at < NOW() AND revoked_at IS NULL`
  );
  return result.rowCount || 0;
}
