"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRequired = authRequired;
exports.authOptional = authOptional;
const jwt_1 = require("../lib/jwt");
const auth_shared_1 = require("../lib/auth.shared");
// lib/jwt.ts의 verifyAccessTokenOrThrow 함수를 사용 (중복 제거)
// 인증 필수 미들웨어
function authRequired(req, res, next) {
    try {
        const token = (0, auth_shared_1.getTokenFromReq)(req);
        if (!token) {
            return res.status(401).json({
                success: false,
                code: "UNAUTHORIZED",
                message: "Authentication required",
                data: null,
                requestId: req.requestId ?? "",
            });
        }
        const { uid } = (0, jwt_1.verifyAccessTokenOrThrow)(token); // lib/jwt.ts의 함수 사용
        // req.user 주입 (기존 코드와 호환: id 필드 사용)
        req.user = { id: uid };
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            code: "UNAUTHORIZED",
            message: error instanceof Error ? error.message : "Authentication failed",
            data: null,
            requestId: req.requestId ?? "",
        });
    }
}
// 인증 선택적 미들웨어
function authOptional(req, res, next) {
    try {
        const token = (0, auth_shared_1.getTokenFromReq)(req);
        if (token) {
            const { uid } = (0, jwt_1.verifyAccessTokenOrThrow)(token); // lib/jwt.ts의 함수 사용
            req.user = { id: uid };
        }
        // 토큰이 없어도 통과 (인증 선택적)
        next();
    }
    catch (error) {
        // 토큰이 있지만 유효하지 않은 경우에도 통과 (선택적이므로)
        next();
    }
}
