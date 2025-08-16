import { Router } from "express";
import type { Response } from "express";
import { requireAuth, AuthedRequest } from "../middlewares/requireAuth";
import { getUserProfile } from "../repos/userRepo";
import { updateUserNickname } from "../repos/userRepo";

export const userRouter = Router();

// GET /api/v1/user/me  (프로필 조회, /auth/me와 유사. 필요시 사용)
userRouter.get("/me", requireAuth, async (req: AuthedRequest, res: Response) => {
  const user = await getUserProfile(req.userId!);
  return res.ok({ user }, "USER_ME_OK");
});

// POST /api/v1/user/profile { nickname }
userRouter.post("/profile", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { nickname } = req.body as { nickname?: string };
  if (nickname !== undefined && typeof nickname !== "string") {
    return res.fail("INVALID_ARG", "nickname must be string", 400);
  }
  const ok = await updateUserNickname(req.userId!, nickname ?? null);
  if (!ok) return res.fail("UPDATE_FAILED", "could not update", 500);

  const user = await getUserProfile(req.userId!);
  return res.ok({ user }, "USER_UPDATED");
});

export default userRouter;
