"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertActiveSession = upsertActiveSession;
exports.markPhoneVerified = markPhoneVerified;
exports.findActiveByPhone = findActiveByPhone;
exports.completeAndDelete = completeAndDelete;
const db_1 = require("../db");
/** Upsert active session keyed by phone */
async function upsertActiveSession(phone, carrier, ttlSec) {
    const expiresAtSql = `NOW() + INTERVAL '${ttlSec} seconds'`;
    await (0, db_1.query)(`
    INSERT INTO signup_sessions (phone_e164_norm, carrier, phone_verified, purpose, expires_at, created_at, updated_at)
    VALUES ($1, $2, FALSE, 'register', ${expiresAtSql}, NOW(), NOW())
    ON CONFLICT (phone_e164_norm)
    DO UPDATE SET carrier = EXCLUDED.carrier, expires_at = ${expiresAtSql}, updated_at = NOW()
  `, [phone, carrier]);
}
async function markPhoneVerified(phone) {
    await (0, db_1.query)(`UPDATE signup_sessions SET phone_verified = TRUE, updated_at = NOW() WHERE phone_e164_norm = $1`, [phone]);
}
async function findActiveByPhone(phone) {
    const rows = await (0, db_1.query)(`SELECT * FROM signup_sessions WHERE phone_e164_norm = $1 AND expires_at > NOW()`, [phone]);
    return rows[0] ?? null;
}
async function completeAndDelete(phone) {
    await (0, db_1.query)(`DELETE FROM signup_sessions WHERE phone_e164_norm = $1`, [phone]);
}
