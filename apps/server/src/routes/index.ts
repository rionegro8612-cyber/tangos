// apps/server/src/routes/index.ts
import { Router } from "express";
import authRouter from "./auth.mvp";
import kycRouter from "./kyc.mvp";
import userRouter from "./user";

export const router = Router();

// 헬스체크
router.get("/_ping", (_req, res) => res.json({ ok: true }));

// Auth (로그인/SMS/리프레시/로그아웃/ME 등)
router.use("/auth", authRouter);
// KYC (PASS/NICE 등)
router.use("/auth", kycRouter);
// User (프로필 등)
router.use("/user", userRouter);

export default router;
