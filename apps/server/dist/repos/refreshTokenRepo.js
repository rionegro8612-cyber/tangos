"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveNewRefreshToken = saveNewRefreshToken;
exports.findByTokenHash = findByTokenHash;
exports.revokeToken = revokeToken;
exports.revokeAllForUser = revokeAllForUser;
// apps/server/src/repos/refreshTokenRepo.ts
const db_1 = require("../lib/db"); // 프로젝트 DB 클라이언트에 맞게 수정
const jwt_1 = require("../lib/jwt");
async function saveNewRefreshToken(args) {
    console.log("[REFRESH_TOKEN_DEBUG] 저장 시도:", {
        jti: args.jti,
        userId: args.userId,
        tokenLength: args.token.length,
        expiresAt: args.expiresAt,
        userAgent: args.userAgent,
        ip: args.ip
    });
    try {
        const hash = (0, jwt_1.sha256)(args.token);
        console.log("[REFRESH_TOKEN_DEBUG] 해시 생성:", hash);
        const result = await db_1.pool.query(`INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_addr)
       VALUES ($1::bigint, $2, $3, $4, $5)`, [args.userId, hash, args.expiresAt, args.userAgent ?? null, args.ip ?? null]);
        console.log("[REFRESH_TOKEN_DEBUG] 저장 성공:", result.rowCount);
    }
    catch (error) {
        console.error("[REFRESH_TOKEN_DEBUG] 저장 실패:", error);
        throw error;
    }
}
async function findByTokenHash(tokenHash) {
    console.log("[REFRESH_TOKEN_DEBUG] 조회 시도:", tokenHash);
    try {
        const result = await db_1.pool.query(`SELECT * FROM auth_refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL`, [tokenHash]);
        console.log("[REFRESH_TOKEN_DEBUG] 조회 결과:", {
            found: result.rows.length > 0,
            count: result.rows.length,
            data: result.rows[0] || null
        });
        const row = result.rows[0];
        return row || null;
    }
    catch (error) {
        console.error("[REFRESH_TOKEN_DEBUG] 조회 실패:", error);
        throw error;
    }
}
async function revokeToken(tokenHash) {
    await db_1.pool.query(`UPDATE auth_refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);
}
async function revokeAllForUser(userId) {
    await db_1.pool.query(`UPDATE auth_refresh_tokens SET revoked_at = NOW() WHERE user_id = $1::uuid AND revoked_at IS NULL`, [userId]);
}
