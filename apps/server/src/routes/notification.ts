import { Router } from "express";
import { sendFCM } from "../lib/vendors/fcm";
import { sendAPNs } from "../lib/vendors/apns";

const router = Router();

// POST /api/v1/notification/push
router.post("/push", async (req, res) => {
  const { token, payload, platform } = req.body || {};
  if (!token || !payload) return res.fail("INVALID_ARG", "token, payload required", 400);
  try {
    let r;
    if (platform === "ios") r = await sendAPNs(token, payload);
    else r = await sendFCM(token, payload);
    return res.ok({ sent: true, providerTraceId: r.providerTraceId });
  } catch (e: any) {
    return res.fail("PUSH_FAILED", e.message || "push failed", 502);
  }
});

export default router;
