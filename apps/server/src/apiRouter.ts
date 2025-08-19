import { Router } from "express";
import { kycRouter } from "./routes/kyc";
// import ... (auth, user 등 다른 라우터)

export const router = Router();

// 기존 라우터들...
// router.use("/auth", authRouter);
// router.use("/users", userRouter);

// ✅ KYC 라우터를 /api/v1/auth/* 하위로 마운트
router.use("/auth", kycRouter);

