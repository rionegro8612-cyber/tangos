"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRequired = authRequired;
const jwt_1 = require("../lib/jwt");
const cookies_1 = require("../lib/cookies");
const uuid_1 = require("uuid");
function getTokenFromReq(req) {
    const hdr = req.headers.authorization ?? "";
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    if (m?.[1])
        return m[1];
    return req.cookies?.[cookies_1.ACCESS_COOKIE];
}
function authRequired(req, res, next) {
    try {
        const token = getTokenFromReq(req);
        if (!token)
            return res.fail("AUTH_401", "인증이 필요합니다.", 401);
        const payload = (0, jwt_1.verifyAccessToken)(token);
        const userId = String(payload.uid);
        // UUID 형식 검증 (uuidValidate 사용)
        if (!userId || !(0, uuid_1.validate)(userId)) {
            return res.fail("AUTH_401", "유효하지 않은 사용자 ID 형식입니다.", 401);
        }
        req.user = { id: userId };
        next();
    }
    catch {
        return res.fail("AUTH_401", "유효하지 않은 토큰입니다.", 401);
    }
}
