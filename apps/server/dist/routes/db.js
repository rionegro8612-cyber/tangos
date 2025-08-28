"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const router = (0, express_1.Router)();
router.get('/ping', async (_req, res) => {
    const { rows } = await db_1.pool.query('SELECT 1 as ok');
    res.json({ ok: rows[0].ok === 1 });
});
exports.default = router;
