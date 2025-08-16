import { NextResponse } from "next/server";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "";

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signJwt(payload: Record<string, any>, expiresInSec = 60 * 60 * 24 * 7) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET is not set");
  const header = { alg: "HS256", typ: "JWT" };
  const nowSec = Math.floor(Date.now() / 1000);
  const body = { iat: nowSec, exp: nowSec + expiresInSec, ...payload };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(body));
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest();
  const s = b64url(sig);
  return `${data}.${s}`;
}

export function setSessionCookie(res: NextResponse, token: string, maxAgeSec = 60 * 60 * 24 * 7) {
  res.cookies.set("tango_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: maxAgeSec,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set("tango_session", "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
}