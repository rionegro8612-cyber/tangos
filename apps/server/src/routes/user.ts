import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authRequired } from "../middlewares/auth";
import { query } from "../db";

export const userRouter = Router();

/** 닉네임 업데이트 */
userRouter.post("/profile", authRequired, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as any).user?.uid as number;
    const { nickname } = (req.body || {}) as { nickname?: string | null };

    await query(
      `UPDATE app_users SET nickname = $1 WHERE id = $2`,
      [nickname ?? null, uid]
    );

    const rows = await query<{ id: string; phone_e164_norm: string; nickname: string | null; last_login_at: string | null; created_at: string }>(
      `SELECT id::text, phone_e164_norm, nickname, last_login_at, created_at
       FROM app_users WHERE id = $1`,
      [uid]
    );

    return res.ok({ user: rows[0] }, "PROFILE_UPDATED");
  } catch (e) {
    next(e);
  }
});

export default userRouter;
