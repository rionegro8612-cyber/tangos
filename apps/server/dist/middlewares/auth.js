"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRequired = authRequired;
exports.authOptional = authOptional;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// 기존 getTokenFromReq 함수와 동일한 로직 (중복 방지)
function getTokenFromReq(req) {
    const hdr = req.headers.authorization || "";
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    return m?.[1] || req.cookies?.access_token;
}
// 토큰 검증 및 사용자 정보 주입
function verifyAccessTokenOrThrow(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "dev-secret");
        // UUID와 정수 모두 허용
        const userId = decoded.userId || decoded.sub || decoded.id;
        if (!userId) {
            throw new Error("Invalid token: missing user ID");
        }
        return { userId };
    }
    catch (error) {
        throw new Error("Invalid or expired token");
    }
}
// 인증 필수 미들웨어
function authRequired(req, res, next) {
    try {
        const token = getTokenFromReq(req);
        if (!token) {
            return res.status(401).json({
                success: false,
                code: "UNAUTHORIZED",
                message: "Authentication required",
                data: null,
                requestId: req.requestId ?? null,
            });
        }
        const { userId } = verifyAccessTokenOrThrow(token);
        // req.user 주입 (기존 코드와 호환: id 필드 사용)
        req.user = { id: userId };
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            code: "UNAUTHORIZED",
            message: error instanceof Error ? error.message : "Authentication failed",
            data: null,
            requestId: req.requestId ?? null,
        });
    }
}
// 인증 선택적 미들웨어
function authOptional(req, res, next) {
    try {
        const token = getTokenFromReq(req);
        if (token) {
            const { userId } = verifyAccessTokenOrThrow(token);
            req.user = { id: userId };
        }
        // 토큰이 없어도 통과 (인증 선택적)
        next();
    }
    catch (error) {
        // 토큰이 있지만 유효하지 않은 경우에도 통과 (선택적이므로)
        next();
    }
}
