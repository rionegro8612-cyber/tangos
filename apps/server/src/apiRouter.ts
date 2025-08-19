import { Router } from "express";
import { loginRouter } from "./routes/auth.login";
import { refreshRouter } from "./routes/auth.refresh";
import { logoutRouter } from "./routes/auth.logout";
import { kycRouter } from "./routes/kyc";

export const router = Router();

router.use("/auth", loginRouter);   // /auth/verify-code (로그인용)
router.use("/auth", refreshRouter); // /auth/refresh
router.use("/auth", logoutRouter);  // /auth/logout
router.use("/auth", kycRouter);     // /auth/kyc/*

