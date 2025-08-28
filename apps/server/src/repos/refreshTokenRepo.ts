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
  // 임시로 테이블이 없으므로 로그만 출력
  console.log("[REFRESH_TOKEN] 저장 시도:", { jti: args.jti, userId: args.userId });
  // TODO: refresh_tokens 테이블 생성 후 활성화
  // const hash = sha256(args.token);
  // await pool.query(
  //   `INSERT INTO refresh_tokens (jti, user_id, token_hash, issued_at, expires_at, revoked, user_agent, ip)
  //    VALUES ($1, $2::uuid, $3, CURRENT_TIMESTAMP, $4, FALSE, $5, $6)`,
  //   [args.jti, args.userId, hash, args.expiresAt, args.userAgent ?? null, args.ip ?? null]
  // );
}

export async function findByJti(jti: string) {
  // 임시로 테이블이 없으므로 null 반환
  console.log("[REFRESH_TOKEN] 조회 시도:", { jti });
  return null;
  // TODO: refresh_tokens 테이블 생성 후 활성화
  // const result = await pool.query(`SELECT * FROM refresh_tokens WHERE jti = $1`, [jti]);
  // const row = result.rows[0];
  // return row || null;
}

export async function revokeJti(jti: string, replacedByJti?: string) {
  // 임시로 테이블이 없으므로 로그만 출력
  console.log("[REFRESH_TOKEN] 폐기 시도:", { jti, replacedByJti });
  // TODO: refresh_tokens 테이블 생성 후 활성화
  // await pool.query(
  //   `UPDATE refresh_tokens SET revoked = TRUE, replaced_by_jti = $1 WHERE jti = $2`,
  //   [replacedByJti ?? null, jti]
  // );
}

export async function revokeAllForUser(userId: string) {
  // 임시로 테이블이 없으므로 로그만 출력
  console.log("[REFRESH_TOKEN] 사용자 전체 폐기 시도:", { userId });
  // TODO: refresh_tokens 테이블 생성 후 활성화
  // await pool.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1::uuid AND revoked = FALSE`, [userId]);
}
