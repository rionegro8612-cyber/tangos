import { Router } from "express";
import { sendFCM } from "../lib/vendors/fcm";
import { sendAPNs } from "../lib/vendors/apns";

const router = Router();

// POST /api/v1/notification/push
router.post("/push", async (req, res) => {
  const { token, payload, platform } = req.body || {};
  if (!token || !payload) return res.fail(400, "INVALID_ARG", "token, payload required");
  try {
    let r;
    if (platform === "ios") r = await sendAPNs(token, payload);
    else r = await sendFCM(token, payload);
    return res.ok({ sent: true, providerTraceId: r.providerTraceId });
  } catch (e:any) {
    return res.fail(502, "PUSH_FAILED", e.message || "push failed");
  }
});

export default router;
