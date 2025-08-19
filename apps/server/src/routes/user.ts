// apps/server/src/routes/user.ts
import { Router } from "express";
import requireAuth from "../middlewares/requireAuth";
const router = Router();

router.get("/me", requireAuth, (req, res) => {
  return res.json({
    success: true,
    code: "OK",
    message: null,
    data: { user: (req as any).user },
    requestId: (req as any).id,
  });
});

export default router;
