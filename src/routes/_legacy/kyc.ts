import { Router } from "express";
import { verifyPASS } from "../lib/vendors/passClient";
import { verifyNICE } from "../lib/vendors/niceClient";

const router = Router();

// POST /api/v1/auth/kyc/pass
router.post("/kyc/pass", async (req, res) => {
  const { name, birth, phone, carrier } = req.body || {};
  if (!name || !birth || !phone || !carrier) {
    return res.fail("INVALID_ARG", "name, birth, phone, carrier required", 400);
  }
  try {
    let verified = false, providerTraceId = "";
    try {
      const r1 = await verifyPASS({ name, birth, phone, carrier });
      verified = r1.verified; providerTraceId = (r1 as any).providerTraceId;
    } catch {
      const r2 = await verifyNICE({ name, birth, phone, carrier });
      verified = r2.verified; providerTraceId = (r2 as any).providerTraceId;
    }
    if (!verified) return res.fail("KYC_FAILED", "KYC verification failed", 403);
    // TODO: update users table with kyc flags
    return res.ok({ kyc: "verified", providerTraceId });
  } catch (e:any) {
    return res.fail("KYC_PROVIDER_ERROR", e.message || "KYC error", 502);
  }
});

export default router;
