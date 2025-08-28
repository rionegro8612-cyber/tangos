"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
const pg_1 = require("pg");
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
}
exports.pool = global.pgPool ??
    new pg_1.Pool({
        connectionString: process.env.DATABASE_URL,
        // ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    });
if (process.env.NODE_ENV !== "production")
    global.pgPool = exports.pool;
async function query(text, params = []) {
    const values = Array.from(params);
    const { rows } = await exports.pool.query(text, values);
    return rows;
}
