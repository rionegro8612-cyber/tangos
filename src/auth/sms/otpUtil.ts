import crypto from "crypto";

export const OTP_TTL_SEC = Number(process.env.OTP_CODE_TTL_SEC ?? 180);
export const RESEND_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SEC ?? 60);

export function genCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function e164(phone: string): string {
  // naive KR normalization: keep digits, assume '010' domestic
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("010") && digits.length === 11) return "+82" + digits.slice(1);
  if (digits.startsWith("82")) return "+" + digits;
  if (digits.startsWith("0")) return "+82" + digits.slice(1);
  if (digits.startsWith("+")) return digits;
  return "+" + digits;
}

export function hashCode(code: string, salt: string) {
  const h = crypto.createHash("sha256");
  h.update(code + ":" + salt);
  return h.digest("hex");
}

export function newSalt() {
  return crypto.randomBytes(16).toString("hex");
}
