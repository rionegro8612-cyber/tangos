"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
// 기존 라우터
const auth_refresh_1 = require("./routes/auth.refresh");
const auth_logout_1 = require("./routes/auth.logout");
const kyc_1 = require("./routes/kyc");
// 새로 추가한 라우터
const auth_register_1 = require("./routes/auth.register");
const profile_1 = __importDefault(require("./routes/profile"));
const location_1 = require("./routes/location");
const auth_mvp_1 = require("./routes/auth.mvp");
const auth_login_1 = require("./routes/auth.login");
exports.router = (0, express_1.Router)();
// ✅ 표준 인증 라우터 (send-sms, resend-sms, verify-code, signup)
exports.router.use("/auth", auth_mvp_1.authRouter);
// ✅ 로그인 전용 라우터 (send-sms, verify-code, me)
exports.router.use("/auth/login", auth_login_1.loginRouter);
// ✅ 기존 기능들 (별도 경로로 분리)
exports.router.use("/auth/refresh", auth_refresh_1.refreshRouter); // /api/v1/auth/refresh
exports.router.use("/auth/logout", auth_logout_1.logoutRouter); // /api/v1/auth/logout
exports.router.use("/auth/kyc", kyc_1.kycRouter); // /api/v1/auth/kyc/*
exports.router.use("/auth/register", auth_register_1.registerRouter); // /api/v1/auth/register/*
// ✅ 프로필 라우터 마운트
exports.router.use("/profile", profile_1.default);
// ✅ 위치 검색 라우터 마운트
exports.router.use("/location", location_1.locationRouter);
exports.router.get("/_ping", (_req, res) => res.status(200).type("text/plain").send("pong"));
console.log("[apiRouter] 라우터 등록 완료", exports.router.stack.length, exports.router.stack.map(l => l.route?.path || l.name));
