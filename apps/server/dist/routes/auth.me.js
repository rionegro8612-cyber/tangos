"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const userRepo_1 = require("../repos/userRepo");
const r = (0, express_1.Router)();
r.get("/me", auth_1.authRequired, async (req, res) => {
    try {
        const user = await (0, userRepo_1.getUserProfile)(req.user.id);
        return res.ok({ user }, "ME_OK");
    }
    catch (error) {
        console.error("[auth.me] Error:", error);
        return res.fail("INTERNAL_ERROR", "사용자 정보를 가져오는데 실패했습니다.", 500);
    }
});
exports.default = r;
