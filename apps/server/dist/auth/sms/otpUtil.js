"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESEND_COOLDOWN_SEC = exports.OTP_TTL_SEC = void 0;
exports.genCode = genCode;
exports.e164 = e164;
exports.hashCode = hashCode;
exports.newSalt = newSalt;
const crypto_1 = __importDefault(require("crypto"));
exports.OTP_TTL_SEC = Number(process.env.OTP_CODE_TTL_SEC ?? 180);
exports.RESEND_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SEC ?? 60);
function genCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function e164(phone) {
    // naive KR normalization: keep digits, assume '010' domestic
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("010") && digits.length === 11)
        return "+82" + digits.slice(1);
    if (digits.startsWith("82"))
        return "+" + digits;
    if (digits.startsWith("0"))
        return "+82" + digits.slice(1);
    if (digits.startsWith("+"))
        return digits;
    return "+" + digits;
}
function hashCode(code, salt) {
    const h = crypto_1.default.createHash("sha256");
    h.update(code + ":" + salt);
    return h.digest("hex");
}
function newSalt() {
    return crypto_1.default.randomBytes(16).toString("hex");
}
