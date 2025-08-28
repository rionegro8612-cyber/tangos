// src/routes/auth.ts
import { Router } from "express";

const router = Router();

router.get("/ping", (_req, res) => res.json({ auth: "ok" }));

export default router; // ✅ default export
