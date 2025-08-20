import { Router } from "express";

// 기존 라우터
import { loginRouter } from "./routes/auth.login";
import { refreshRouter } from "./routes/auth.refresh";
import { logoutRouter } from "./routes/auth.logout";
import { kycRouter } from "./routes/kyc";

// 새로 추가한 라우터
import { registerRouter } from "./routes/auth.register";
import { profileRouter } from "./routes/profile";
import { locationRouter } from "./routes/location";

export const router = Router();

// 기존
router.use("/auth", loginRouter);    // /api/v1/auth/send-sms, /verify-login, /me
router.use("/auth", refreshRouter);  // /api/v1/auth/refresh
router.use("/auth", logoutRouter);   // /api/v1/auth/logout
router.use("/auth", kycRouter);      // /api/v1/auth/kyc/*

// ★ 신규 회원가입/프로필 라우터 장착
router.use("/auth", registerRouter); // /api/v1/auth/register/*
router.use("/", profileRouter);      // /api/v1/profile/*
router.use("/", locationRouter);     // /api/v1/location/*

router.get("/_ping", (_req, res) => res.status(200).type("text/plain").send("pong"));

console.log("[apiRouter] 라우터 등록 완료", router.stack.length, router.stack.map(l => l.route?.path || l.name));
