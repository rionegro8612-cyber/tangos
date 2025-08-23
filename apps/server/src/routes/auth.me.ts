import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { getUserProfile } from "../repos/userRepo";

const r = Router();

r.get("/me", authRequired, async (req: any, res) => {
  try {
    const user = await getUserProfile(req.user.id);
    return res.ok({ user }, "ME_OK");
  } catch (error) {
    console.error("[auth.me] Error:", error);
    return res.fail("INTERNAL_ERROR", "사용자 정보를 가져오는데 실패했습니다.", 500);
  }
});

export default r;
