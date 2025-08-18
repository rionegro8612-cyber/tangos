// apps/server/src/routes/index.ts
import { Router } from "express";
import kycRouter from "./kyc.mvp";   // ⬅️ default export이므로 이렇게 import

export const router = Router();

// 헬스체크
router.get("/_ping", (_req, res) => {
  res.json({ ok: true });
});

// /api/v1/auth/kyc/pass 경로 활성화
router.use("/auth", kycRouter);

