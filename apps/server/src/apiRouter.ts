import { Router } from "express";

// 기존 라우터
import { refreshRouter } from "./routes/auth.refresh";
import { logoutRouter } from "./routes/auth.logout";
import { kycRouter } from "./routes/kyc";

// 새로 추가한 라우터
import { registerRouter } from "./routes/auth.register";
import profileRouter from "./routes/profile";
import { locationRouter } from "./routes/location";
import { authRouter as authMvpRouter } from "./routes/auth.mvp";
import { loginRouter } from "./routes/auth.login";

export const router = Router();

// ✅ 표준 인증 라우터 (send-sms, resend-sms, verify-code, signup)
router.use("/auth", authMvpRouter);

// ✅ 로그인 전용 라우터 (send-sms, verify-code, me)
router.use("/auth/login", loginRouter);

// ✅ 기존 기능들 (별도 경로로 분리)
router.use("/auth/refresh", refreshRouter); // /api/v1/auth/refresh
router.use("/auth/logout", logoutRouter); // /api/v1/auth/logout
router.use("/auth/kyc", kycRouter); // /api/v1/auth/kyc/*
router.use("/auth/register", registerRouter); // /api/v1/auth/register/*

// ✅ 프로필 라우터 마운트
router.use("/profile", profileRouter);

// ✅ 위치 검색 라우터 마운트
router.use("/location", locationRouter);

router.get("/_ping", (_req, res) => res.status(200).type("text/plain").send("pong"));

console.log(
  "[apiRouter] 라우터 등록 완료",
  router.stack.length,
  router.stack.map((l) => l.route?.path || l.name),
);
