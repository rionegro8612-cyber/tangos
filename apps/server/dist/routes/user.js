"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/server/src/routes/user.ts
const express_1 = require("express");
const requireAuth_1 = __importDefault(require("../middlewares/requireAuth"));
const router = (0, express_1.Router)();
router.get("/me", requireAuth_1.default, (req, res) => {
    return res.json({
        success: true,
        code: "OK",
        message: null,
        data: { user: req.user },
        requestId: req.id,
    });
});
exports.default = router;
