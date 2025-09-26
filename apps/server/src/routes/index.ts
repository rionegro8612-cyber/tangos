// apps/server/src/routes/index.ts
import { Router } from "express";
import authRouter from "./auth.mvp";
import { refreshRouter } from "./auth.refresh";
import kycRouter from "./kyc.mvp";
import userRouter from "./user";
import compatV1Router from "./compat.v1";
import registerRouter from "./auth.register";
import registerSubmitRouter from "./register.submit";
import healthRouter from "./health";
import communityRouter from "./community";
import uploadRouter from "./upload";
import profileRouter from "./profile";

export const router = Router();

// 헬스체크 및 상태 모니터링
router.use("/", healthRouter);

// 새로운 표준 인증 API (우선순위 높음)
router.use("/auth", authRouter);

// 리프레시 토큰 갱신 API
router.use("/auth", refreshRouter);

// 새로운 표준 회원가입 API (start, verify, complete)
router.use("/auth/register", registerRouter);

// 새로운 표준 회원가입 제출 API
router.use("/auth/register", registerSubmitRouter);

// Community (posts, feed 등) - 명시적 prefix로 고정
router.use("/community", communityRouter);

// Upload (MinIO 파일 업로드)
router.use("/upload", uploadRouter);

// KYC (PASS/NICE 등)
router.use("/auth", kycRouter);

// User (프로필 등)
router.use("/user", userRouter);

// Profile (닉네임, 지역 등)
router.use("/profile", profileRouter);

// 호환성 프록시 라우터 (compat.v1.ts의 /auth/register/* 포함) - 마지막에 위치
router.use("/", compatV1Router);

export default router;
