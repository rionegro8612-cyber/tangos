import crypto from "crypto";

export function normalizeE164(phone: string) {
  const p = phone.replace(/[^\d+0-9]/g, "");
  if (p.startsWith("+")) return p;
  if (p.startsWith("0")) return "+82" + p.slice(1);
  if (p.startsWith("82")) return "+" + p;
  return "+82" + p;
}

export function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function randomSalt(len = 16) {
  return crypto.randomBytes(len).toString("hex").slice(0, len);
}

export function hashCode(code: string, salt: string) {
  return crypto.createHash("sha256").update(code + ":" + salt).digest("hex");
}