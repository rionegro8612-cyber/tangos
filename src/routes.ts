import { Router } from "express";
import authRouter from "./routes/auth.mvp";
import userRouter from "./routes/user";

export const router = Router();

router.get("/ping", (_req, res) => res.ok({ pong: true }, "PONG"));
router.use("/auth", authRouter);
router.use("/user", userRouter); // ★ 추가
