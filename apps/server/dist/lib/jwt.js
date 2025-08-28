"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.signAccess = void 0;
exports.newJti = newJti;
exports.sha256 = sha256;
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
// apps/server/src/lib/jwt.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
/** 환경설정 */
const SECRET = process.env.JWT_SECRET || "dev_only_change_me";
const ACCESS_MIN = Number(process.env.JWT_ACCESS_EXPIRES_MIN || 30); // 30분
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30); // 30일
/** JTI 생성기 */
function newJti() {
    return crypto_1.default.randomBytes(16).toString("hex");
}
/** SHA-256 (RT 해시 저장용) */
function sha256(input) {
    return crypto_1.default.createHash("sha256").update(input, "utf8").digest("hex");
}
/** Access Token 발급 */
function signAccessToken(uid, jti) {
    const payload = { uid, jti };
    return jsonwebtoken_1.default.sign(payload, SECRET, {
        algorithm: "HS256",
        expiresIn: `${ACCESS_MIN}m`,
        issuer: "tango",
    });
}
/** Refresh Token 발급 */
function signRefreshToken(uid, jti) {
    const payload = { uid, jti };
    return jsonwebtoken_1.default.sign(payload, SECRET, {
        algorithm: "HS256",
        expiresIn: `${REFRESH_DAYS}d`,
        issuer: "tango",
    });
}
/** Access Token 검증 */
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, SECRET);
}
/** Refresh Token 검증 */
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, SECRET);
}
/** ───── 호환성 alias (기존 코드가 참조해도 깨지지 않게) ───── */
exports.signAccess = signAccessToken;
exports.verifyToken = verifyAccessToken;
