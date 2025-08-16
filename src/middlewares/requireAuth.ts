import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

export interface AuthedRequest extends Request {
  userId?: number;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const hdr = req.headers.authorization ?? "";
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1] || (req.cookies?.access_token as string | undefined);
    if (!token) return res.fail("UNAUTHORIZED", "missing token", 401);

    const decoded: any = verifyToken(token);
    const uid = Number(decoded?.uid);
    if (!uid) return res.fail("UNAUTHORIZED", "invalid token", 401);

    req.userId = uid;
    next();
  } catch (e: any) {
    return res.fail("UNAUTHORIZED", e?.message || "unauthorized", 401);
  }
}
