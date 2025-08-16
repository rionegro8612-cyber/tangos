import { Router } from "express";
import { authRouter } from "./routes/auth.mvp"; // ← 여기만 고치면 됨

export const router = Router();

router.get("/ping", (_req, res) => res.ok({ pong: true }, "PONG"));
router.use("/auth", authRouter);

export default router;
