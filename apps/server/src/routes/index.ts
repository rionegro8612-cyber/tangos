// apps/server/src/routes/index.ts
import { Router } from "express";
import authRouter from "./auth.mvp";
import { refreshRouter } from "./auth.refresh";
import kycRouter from "./kyc.mvp";
import userRouter from "./user";
import compatV1Router from "./compat.v1";
import registerRouter from "./auth.register";
import registerSubmitRouter from "./register.submit";
import communityRouter from "./community";
import uploadRouter from "./upload";
import profileRouter from "./profile";

export const router = Router();

// 🆕 핑 엔드포인트 추가 (가장 먼저 정의)
router.get("/_ping", (_req, res) => res.status(200).type("text/plain").send("pong"));

// 새로운 표준 인증 API (우선순위 높음)
router.use("/auth", authRouter);

// 리프레시 토큰 갱신 API
router.use("/auth", refreshRouter);

// 새로운 표준 회원가입 API (start, verify, complete)
router.use("/auth/register", registerRouter);

// 새로운 표준 회원가입 제출 API
router.use("/auth/register", registerSubmitRouter);

// 호환성 프록시 라우터 (compat.v1.ts의 /auth/register/* 포함)
router.use("/auth", compatV1Router);

// KYC (PASS/NICE 등)
router.use("/auth", kycRouter);

// User (프로필 등)
router.use("/user", userRouter);

// Community (커뮤니티 기능)
router.use("/community", communityRouter);

// Upload (파일 업로드)
router.use("/upload", uploadRouter);

// Profile (프로필 관리)
router.use("/profile", profileRouter);

export default router;
