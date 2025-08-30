"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/auth.ts
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get("/ping", (_req, res) => res.json({ auth: "ok" }));
exports.default = router; // ✅ default export
