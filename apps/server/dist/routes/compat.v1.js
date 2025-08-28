"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// 기존 엔드포인트를 새 표준 API로 프록시
// Deprecation 헤더와 함께 경고 메시지 포함
/** POST /api/v1/auth/verify-login (Deprecated) */
router.post("/auth/verify-login", (req, res, next) => {
    // Deprecation 헤더 설정
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()); // 2주 후
    // 로그 기록
    console.warn(`[DEPRECATED] /api/v1/auth/verify-login called from ${req.ip}, redirecting to /verify-code`);
    // 새 엔드포인트로 요청 전달
    req.url = "/auth/verify-code";
    next();
});
/** POST /api/v1/auth/register/verify (Deprecated) */
router.post("/auth/register/verify", (req, res, next) => {
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString());
    console.warn(`[DEPRECATED] /api/v1/auth/register/verify called from ${req.ip}, redirecting to /verify-code`);
    req.url = "/auth/verify-code";
    next();
});
/** POST /api/v1/auth/send-sms (Deprecated) */
router.post("/auth/send-sms", (req, res, next) => {
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString());
    console.warn(`[DEPRECATED] /api/v1/auth/send-sms called from ${req.ip}, redirecting to /send-sms`);
    req.url = "/auth/send-sms";
    next();
});
// 기타 호환성 엔드포인트들...
router.post("/auth/register/start", (req, res, next) => {
    res.setHeader("Deprecation", "true");
    console.warn(`[DEPRECATED] /api/v1/auth/register/start called from ${req.ip}`);
    // 임시로 성공 응답 (기존 로직과 연동 필요)
    return res.json({
        success: true,
        code: "OK",
        message: "REG_START_OK (Deprecated)",
        data: {
            started: true,
            phone: req.body.phone,
            carrier: req.body.carrier,
            ttlSec: 1800
        },
        requestId: req.requestId ?? null,
    });
});
router.post("/auth/register/complete", (req, res, next) => {
    res.setHeader("Deprecation", "true");
    console.warn(`[DEPRECATED] /api/v1/auth/register/complete called from ${req.ip}`);
    // 임시로 성공 응답 (기존 로직과 연동 필요)
    return res.json({
        success: true,
        code: "OK",
        message: "REG_COMPLETE_OK (Deprecated)",
        data: {
            registered: true,
            message: "Registration completed (Deprecated)"
        },
        requestId: req.requestId ?? null,
    });
});
exports.default = router;
