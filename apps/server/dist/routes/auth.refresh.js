"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshRouter = void 0;
const express_1 = require("express");
const cookies_1 = require("../lib/cookies");
const jwt_1 = require("../lib/jwt");
const refreshTokenRepo_1 = require("../repos/refreshTokenRepo");
exports.refreshRouter = (0, express_1.Router)();
exports.refreshRouter.post("/refresh", async (req, res) => {
    const rt = req.cookies?.[cookies_1.REFRESH_COOKIE];
    if (!rt)
        return res.fail("AUTH_NO_RT", "리프레시 토큰이 없습니다.", 401);
    try {
        const payload = (0, jwt_1.verifyRefreshToken)(rt); // { uid, jti }
        const tokenHash = (0, jwt_1.sha256)(rt);
        const record = await (0, refreshTokenRepo_1.findByTokenHash)(tokenHash);
        if (!record) {
            await (0, refreshTokenRepo_1.revokeAllForUser)(String(payload.uid));
            (0, cookies_1.clearAuthCookies)(res);
            return res.fail("AUTH_RT_REUSE", "세션 재인증이 필요합니다.", 401);
        }
        // 토큰 회전: 새 토큰 발급
        const newId = (0, jwt_1.newJti)();
        const at = (0, jwt_1.signAccessToken)(String(payload.uid), newId);
        const newRt = (0, jwt_1.signRefreshToken)(String(payload.uid), newId);
        // 기존 토큰 폐기
        await (0, refreshTokenRepo_1.revokeToken)(tokenHash);
        // 새 토큰 저장
        await (0, refreshTokenRepo_1.saveNewRefreshToken)({
            jti: newId,
            userId: String(payload.uid),
            token: newRt,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            userAgent: req.get("user-agent") || undefined,
            ip: req.ip,
        });
        (0, cookies_1.setAuthCookies)(res, at, newRt);
        return res.ok({ refreshed: true }, "토큰이 갱신되었습니다.");
    }
    catch (error) {
        console.error("[REFRESH] 토큰 검증 실패:", error);
        (0, cookies_1.clearAuthCookies)(res);
        return res.fail("AUTH_RT_INVALID", "유효하지 않은 리프레시 토큰입니다.", 401);
    }
});
