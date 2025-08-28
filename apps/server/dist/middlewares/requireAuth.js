"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = requireAuth;
const jwt_1 = require("../lib/jwt");
const cookies_1 = require("../lib/cookies");
function requireAuth(req, res, next) {
    try {
        let token = req.cookies?.[cookies_1.COOKIE_NAME];
        if (!token) {
            const h = req.headers.authorization || "";
            if (h.startsWith("Bearer "))
                token = h.slice(7);
        }
        if (!token) {
            return res.fail("UNAUTHORIZED", "missing token", 401);
        }
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        req.user = decoded;
        next();
    }
    catch (e) {
        return res.fail("UNAUTHORIZED", e?.message || "unauthorized", 401);
    }
}
