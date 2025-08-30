"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/mvp.ts
const express_1 = require("express");
const db_1 = __importDefault(require("./db"));
const auth_mvp_1 = __importDefault(require("./auth.mvp"));
const kyc_mvp_1 = __importDefault(require("./kyc.mvp"));
const user_1 = __importDefault(require("./user")); // ✅ 꼭 필요
const auth_me_1 = __importDefault(require("./auth.me")); // /api/v1/auth/me
const profile_1 = __importDefault(require("./profile")); // /api/v1/profile/...
const router = (0, express_1.Router)();
// 경로 프리픽스와 순서 유의!
router.use("/db", db_1.default); // /api/v1/db/ping
router.use(auth_mvp_1.default); // /api/v1/auth/...
router.use("/auth", kyc_mvp_1.default); // /api/v1/auth/kyc/pass
router.use("/auth", auth_me_1.default); // /api/v1/auth/me
router.use(user_1.default); // ✅ /api/v1/me
router.use("/profile", profile_1.default); // /api/v1/profile/...
exports.default = router;
