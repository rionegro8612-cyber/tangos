"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutRouter = void 0;
const express_1 = require("express");
const cookies_1 = require("../lib/cookies");
const jwt_1 = require("../lib/jwt");
const refreshTokenRepo_1 = require("../repos/refreshTokenRepo");
exports.logoutRouter = (0, express_1.Router)();
exports.logoutRouter.post("/logout", async (req, res) => {
    const rt = req.cookies?.[cookies_1.REFRESH_COOKIE];
    if (rt) {
        try {
            const payload = (0, jwt_1.verifyRefreshToken)(rt);
            const tokenHash = (0, jwt_1.sha256)(rt);
            await (0, refreshTokenRepo_1.revokeToken)(tokenHash);
        }
        catch {
            /* ignore */
        }
    }
    (0, cookies_1.clearAuthCookies)(res);
    return res.ok({ loggedOut: true }, "OK");
});
