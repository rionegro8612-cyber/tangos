"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/server/src/routes/user.ts
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.get("/me", auth_1.authRequired, (req, res) => {
    return res.json({
        success: true,
        code: "OK",
        message: null,
        data: { user: req.user },
        requestId: req.id,
    });
});
exports.default = router;
