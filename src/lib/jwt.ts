import jwt, { SignOptions } from "jsonwebtoken";

const ACCESS_MIN = Number(process.env.JWT_ACCESS_EXPIRES_MIN ?? 15);
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 14);

if (!process.env.JWT_PRIVATE_KEY || !process.env.JWT_PUBLIC_KEY) {
  console.warn("[jwt] JWT_PRIVATE_KEY/JWT_PUBLIC_KEY is not set (dev only).");
}

export function signAccess(payload: object) {
  const opts: SignOptions = { algorithm: "RS256", expiresIn: `${ACCESS_MIN}m` };
  return jwt.sign(payload, process.env.JWT_PRIVATE_KEY as string, opts);
}

export function signRefresh(payload: object) {
  const opts: SignOptions = { algorithm: "RS256", expiresIn: `${REFRESH_DAYS}d` };
  return jwt.sign(payload, process.env.JWT_PRIVATE_KEY as string, opts);
}

export function verifyToken(token: string) {
  return jwt.verify(token, process.env.JWT_PUBLIC_KEY as string) as any;
}
