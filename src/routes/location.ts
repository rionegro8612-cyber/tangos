import { Router } from "express";
import { searchAddressKakao } from "../lib/vendors/kakaoMaps";
import { searchAddressVWorld } from "../lib/vendors/vworld";

const router = Router();

// GET /api/v1/location/search?q=...
router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.fail("INVALID_ARG", "q is required", 400);
  try {
    let result = await searchAddressKakao(q);
    if (!result.items?.length) {
      result = await searchAddressVWorld(q);
    }
    return res.ok({ items: result.items, providerTraceId: result.providerTraceId });
  } catch (e:any) {
    return res.fail("GEO_LOOKUP_FAILED", e.message || "geo lookup failed", 502);
  }
});

export default router;
