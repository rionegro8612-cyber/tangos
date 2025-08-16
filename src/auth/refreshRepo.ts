import crypto from "crypto";
import { query } from "../db";

export function sha256hex(s: string) {
  const h = crypto.createHash("sha256");
  h.update(s);
  return h.digest("hex");
}

export async function storeRefresh(userId: number, token: string, expiresAtISO: string, ua?: string, ip?: string) {
  const hash = sha256hex(token);
  await query(
    `INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_addr)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, hash, expiresAtISO, ua || null, ip || null]
  );
}

export async function revokeRefresh(token: string) {
  const hash = sha256hex(token);
  await query(
    `UPDATE auth_refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hash]
  );
}

export async function isRefreshValid(userId: number, token: string) {
  const hash = sha256hex(token);
  const rows = await query<{ id: number }>(
    `SELECT id FROM auth_refresh_tokens
     WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > NOW()`,
    [userId, hash]
  );
  return !!rows[0];
}
