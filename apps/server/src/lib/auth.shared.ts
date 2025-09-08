// lib/auth.shared.ts (공용)
import { Request } from "express";

export function getTokenFromReq(req: Request): string | null {
  // 1) HttpOnly 쿠키 우선
  const c = (req as any).cookies?.access_token;
  if (c) return c;
  // 2) Authorization: Bearer
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return null;
}









