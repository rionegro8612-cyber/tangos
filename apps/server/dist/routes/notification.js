"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fcm_1 = require("../lib/vendors/fcm");
const apns_1 = require("../lib/vendors/apns");
const router = (0, express_1.Router)();
// POST /api/v1/notification/push
router.post("/push", async (req, res) => {
    const { token, payload, platform } = req.body || {};
    if (!token || !payload)
        return res.fail("INVALID_ARG", "token, payload required", 400);
    try {
        let r;
        if (platform === "ios")
            r = await (0, apns_1.sendAPNs)(token, payload);
        else
            r = await (0, fcm_1.sendFCM)(token, payload);
        return res.ok({ sent: true, providerTraceId: r.providerTraceId });
    }
    catch (e) {
        return res.fail("PUSH_FAILED", e.message || "push failed", 502);
    }
});
exports.default = router;
