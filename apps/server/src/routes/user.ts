// apps/server/src/routes/user.ts
import { Router } from "express";
import { authRequired } from "../middlewares/auth";
const router = Router();

router.get("/me", authRequired, (req, res) => {
  return res.json({
    success: true,
    code: "OK",
    message: null,
    data: { user: (req as any).user },
    requestId: (req as any).id,
  });
});

export default router;
