"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbRouter = void 0;
const express_1 = require("express");
const db_1 = require("./db");
exports.dbRouter = (0, express_1.Router)();
exports.dbRouter.get('/ping', async (req, res) => {
    try {
        const result = await db_1.pool.query('SELECT NOW()');
        res.json({ success: true, code: 'OK', message: 'db ok', data: { now: result.rows[0].now }, requestId: 'dev' });
    }
    catch (err) {
        res.status(500).json({ success: false, code: 'DB_ERROR', message: err.message, requestId: 'dev' });
    }
});
