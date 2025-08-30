"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
// apps/server/src/lib/db.ts
const pg_1 = require("pg");
// NOTE:
// - dotenv 로드는 src/index.ts에서 `import "./env"`로 이미 끝났다고 가정합니다.
// - 여기서는 __dirname, import.meta.url 같은 경로 계산을 전혀 사용하지 않습니다.
function required(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`[DB] Missing required env: ${name}`);
    return v;
}
const sslRequired = (process.env.PGSSLMODE || process.env.DB_SSLMODE) === "require"
    ? { rejectUnauthorized: false }
    : undefined;
let pool;
if (process.env.DATABASE_URL) {
    // 우선순위 1: DATABASE_URL
    exports.pool = pool = new pg_1.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: sslRequired,
    });
}
else {
    // 우선순위 2: 개별 변수(DB_*)
    const host = required("DB_HOST");
    const port = Number(required("DB_PORT"));
    const user = required("DB_USER");
    const password = String(required("DB_PASSWORD"));
    const database = required("DB_NAME");
    exports.pool = pool = new pg_1.Pool({
        host,
        port,
        user,
        password,
        database,
        ssl: sslRequired,
    });
}
/**
 * 데이터베이스 쿼리 실행 함수
 */
async function query(text, params) {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return {
            rows: result.rows,
            rowCount: result.rowCount || 0,
        };
    }
    finally {
        client.release();
    }
}
