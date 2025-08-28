"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// apps/server/src/routes/index.ts
const express_1 = require("express");
const auth_mvp_1 = __importDefault(require("./auth.mvp"));
const kyc_mvp_1 = __importDefault(require("./kyc.mvp"));
const user_1 = __importDefault(require("./user"));
const compat_v1_1 = __importDefault(require("./compat.v1"));
const auth_register_1 = __importDefault(require("./auth.register"));
const register_submit_1 = __importDefault(require("./register.submit"));
const health_1 = __importDefault(require("./health"));
exports.router = (0, express_1.Router)();
// 헬스체크 및 상태 모니터링
exports.router.use("/", health_1.default);
// 새로운 표준 인증 API (우선순위 높음)
exports.router.use("/auth", auth_mvp_1.default);
// 새로운 표준 회원가입 API (start, verify, complete)
exports.router.use("/auth/register", auth_register_1.default);
// 새로운 표준 회원가입 제출 API
exports.router.use("/auth/register", register_submit_1.default);
// 호환성 프록시 라우터 (compat.v1.ts의 /auth/register/* 포함)
exports.router.use("/", compat_v1_1.default);
// 기존 Auth (로그인/SMS/리프레시/로그아웃/ME 등)
exports.router.use("/auth", auth_mvp_1.default);
// KYC (PASS/NICE 등)
exports.router.use("/auth", kyc_mvp_1.default);
// User (프로필 등)
exports.router.use("/user", user_1.default);
// 호환성 라우터 (Deprecated 엔드포인트들)
exports.router.use("/", compat_v1_1.default);
exports.default = exports.router;
