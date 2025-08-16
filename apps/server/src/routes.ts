import { Router } from "express";
import authRouter from "./routes/auth.mvp";
import userRouter from "./routes/user";      // ← 추가

export const router = Router();

router.use("/auth", authRouter);
router.use("/user", userRouter);             // ← 추가

export default router;

