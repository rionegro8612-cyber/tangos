"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// apps/server/src/routes/index.ts
const express_1 = require("express");
const auth_mvp_1 = __importDefault(require("./auth.mvp"));
const auth_refresh_1 = require("./auth.refresh");
const kyc_mvp_1 = __importDefault(require("./kyc.mvp"));
const user_1 = __importDefault(require("./user"));
const compat_v1_1 = __importDefault(require("./compat.v1"));
const auth_register_1 = __importDefault(require("./auth.register"));
const register_submit_1 = __importDefault(require("./register.submit"));
const community_1 = __importDefault(require("./community"));
const upload_1 = __importDefault(require("./upload"));
const profile_1 = __importDefault(require("./profile"));
exports.router = (0, express_1.Router)();
// 🆕 핑 엔드포인트 추가 (가장 먼저 정의)
exports.router.get("/_ping", (_req, res) => res.status(200).type("text/plain").send("pong"));
// 새로운 표준 인증 API (우선순위 높음)
exports.router.use("/auth", auth_mvp_1.default);
// 리프레시 토큰 갱신 API
exports.router.use("/auth", auth_refresh_1.refreshRouter);
// 새로운 표준 회원가입 API (start, verify, complete)
exports.router.use("/auth/register", auth_register_1.default);
// 새로운 표준 회원가입 제출 API
exports.router.use("/auth/register", register_submit_1.default);
// 호환성 프록시 라우터 (compat.v1.ts의 /auth/register/* 포함)
exports.router.use("/auth", compat_v1_1.default);
// KYC (PASS/NICE 등)
exports.router.use("/auth", kyc_mvp_1.default);
// User (프로필 등)
exports.router.use("/user", user_1.default);
// Community (커뮤니티 기능)
exports.router.use("/community", community_1.default);
// Upload (파일 업로드)
exports.router.use("/upload", upload_1.default);
// Profile (프로필 관리)
exports.router.use("/profile", profile_1.default);
exports.default = exports.router;
