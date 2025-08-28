"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_service_js_1 = require("./auth.service.js");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/phone/verify', async (req, res) => {
    const { phone, code } = req.body;
    try {
        const result = await (0, auth_service_js_1.verifyPhoneCode)(phone, code);
        res.json({ success: true, code: 'OK', message: 'verified', data: result });
    }
    catch (err) {
        res.status(400).json({ success: false, code: 'VERIFY_FAILED', message: err.message });
    }
});
