// apps/server/src/middlewares/requireAuth.ts
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { COOKIE_NAME } from "../lib/cookies";

export default function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      const h = req.headers.authorization || "";
      if (h.startsWith("Bearer ")) token = h.slice(7);
    }
    if (!token) {
      return res.fail("UNAUTHORIZED", "missing token", 401);
    }
    const decoded = verifyAccessToken(token);
    (req as any).user = decoded;
    next();
  } catch (e: any) {
    return res.fail("UNAUTHORIZED", e?.message || "unauthorized", 401);
  }
}
