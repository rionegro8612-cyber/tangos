// apps/server/src/middlewares/requireAuth.ts
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { COOKIE_NAME } from "../lib/cookies";

export default function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      const h = req.headers.authorization || "";
      if (h.startsWith("Bearer ")) token = h.slice(7);
    }
    if (!token) {
      return res.status(401).json({ success: false, code: "UNAUTHORIZED", message: "no token", data: null, requestId: (req as any).id });
    }
    const decoded = verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (e: any) {
    return res.status(401).json({ success: false, code: "UNAUTHORIZED", message: e?.message || "invalid token", data: null, requestId: (req as any).id });
  }
}
