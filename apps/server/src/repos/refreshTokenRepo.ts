// apps/server/src/repos/refreshTokenRepo.ts
import { pool } from "../lib/db"; // 프로젝트 DB 클라이언트에 맞게 수정
import { sha256 } from "../lib/jwt";

export async function saveNewRefreshToken(args: {
  jti: string;
  userId: string;
  token: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}) {
  console.log("[REFRESH_TOKEN_DEBUG] 저장 시도:", {
    jti: args.jti,
    userId: args.userId,
    tokenLength: args.token.length,
    expiresAt: args.expiresAt,
    userAgent: args.userAgent,
    ip: args.ip
  });
  
  const client = await pool.connect();
  try {
    // 동시성 문제 방지를 위해 격리 수준 설정
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    
    const hash = sha256(args.token);
    console.log("[REFRESH_TOKEN_DEBUG] 해시 생성:", hash);
    
    // 1단계: 기존 활성 토큰들을 폐기 (회전)
    console.log("[REFRESH_TOKEN_DEBUG] 기존 토큰 폐기 시작");
    const revokeResult = await client.query(
      `UPDATE auth_refresh_tokens 
       SET revoked_at = NOW() 
       WHERE user_id = $1::bigint AND revoked_at IS NULL`,
      [args.userId]
    );
    console.log("[REFRESH_TOKEN_DEBUG] 폐기된 토큰 수:", revokeResult.rowCount);
    
    // 2단계: 새로운 토큰 저장
    const result = await client.query(
      `INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_addr)
       VALUES ($1::bigint, $2, $3, $4, $5)`,
      [args.userId, hash, args.expiresAt, args.userAgent ?? null, args.ip ?? null]
    );
    
    await client.query('COMMIT');
    console.log("[REFRESH_TOKEN_DEBUG] 회전 저장 성공:", result.rowCount);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("[REFRESH_TOKEN_DEBUG] 저장 실패:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function findByTokenHash(tokenHash: string) {
  console.log("[REFRESH_TOKEN_DEBUG] 조회 시도:", tokenHash);
  
  try {
    const result = await pool.query(
      `SELECT * FROM auth_refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL`, 
      [tokenHash]
    );
    
    console.log("[REFRESH_TOKEN_DEBUG] 조회 결과:", {
      found: result.rows.length > 0,
      count: result.rows.length,
      data: result.rows[0] || null
    });
    
    const row = result.rows[0];
    return row || null;
  } catch (error) {
    console.error("[REFRESH_TOKEN_DEBUG] 조회 실패:", error);
    throw error;
  }
}

export async function revokeToken(tokenHash: string) {
  await pool.query(
    `UPDATE auth_refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
    [tokenHash]
  );
}

export async function revokeAllForUser(userId: string) {
  console.log("[REFRESH_TOKEN_DEBUG] 사용자 토큰 폐기:", userId);
  const result = await pool.query(
    `UPDATE auth_refresh_tokens SET revoked_at = NOW() WHERE user_id = $1::bigint AND revoked_at IS NULL`, 
    [userId]
  );
  console.log("[REFRESH_TOKEN_DEBUG] 폐기된 토큰 수:", result.rowCount);
}
