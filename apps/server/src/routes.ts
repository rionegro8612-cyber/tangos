import { Router } from "express";
import authRouter from "./routes/auth.mvp";
import userRouter from "./routes/user";      // ← 추가
import kycRouter from "./routes/kyc.mvp";

export const router = Router();

router.use("/auth", authRouter);
router.use("/auth", kycRouter);
router.use("/user", userRouter);             // ← 추가

export default router;

