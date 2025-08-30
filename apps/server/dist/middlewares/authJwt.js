"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authJwt;
const jwt_1 = require("../lib/jwt");
const cookies_1 = require("../lib/cookies");
const uuid_1 = require("uuid");
async function authJwt(req, res, next) {
    try {
        // 1) 토큰 추출: Bearer 또는 쿠키(access_token)
        const header = req.headers.authorization || "";
        const m = header.match(/^Bearer\s+(.+)$/i);
        const token = m?.[1] || (0, cookies_1.getAccessTokenFromCookies)(req.cookies);
        if (!token) {
            return res
                .status(401)
                .json({ success: false, code: "NO_TOKEN", message: "missing bearer token" });
        }
        // 2) 검증 및 페이로드 파싱
        const payload = (0, jwt_1.verifyToken)(token); // { uid, jti, iat, exp, ... }
        const uid = String(payload?.uid ?? payload?.sub ?? payload?.userId ?? "");
        if (!uid || !(0, uuid_1.validate)(uid)) {
            return res
                .status(401)
                .json({ success: false, code: "BAD_TOKEN", message: "invalid payload or uid format" });
        }
        // 3) 통과 → req.user에 식별자 저장
        req.user = { id: uid };
        next();
    }
    catch (e) {
        return res
            .status(401)
            .json({ success: false, code: "BAD_TOKEN", message: e?.message || "invalid token" });
    }
}
