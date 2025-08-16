import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];
  if (!token) return res.status(401).json({ success:false, code:"UNAUTHORIZED", message:"Missing token", data:null, requestId: (req as any).requestId ?? null });
  try {
    const decoded = verifyToken(token);
    (req as any).userId = Number(decoded?.uid);
    if (!req.userId) throw new Error("Invalid token");
    next();
  } catch (e:any) {
    return res.status(401).json({ success:false, code:"UNAUTHORIZED", message: e?.message || "Invalid token", data:null, requestId: (req as any).requestId ?? null });
  }
}
