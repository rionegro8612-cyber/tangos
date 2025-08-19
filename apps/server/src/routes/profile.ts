
import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { query } from "../db";

export const profileRouter = Router();

/** GET /api/v1/profile/nickname/check?value=xxx */
profileRouter.get("/profile/nickname/check", async (req, res) => {
  const value = String(req.query.value ?? "").trim();
  if (!value) return res.fail(400, "VAL_400", "nickname 쿼리 필요");
  const rows = await query(`SELECT 1 FROM users WHERE nickname = $1`, [value]);
  return res.ok({ available: rows.length === 0 });
});

/** POST /api/v1/profile/nickname { nickname } */
profileRouter.post("/profile/nickname", authRequired, async (req, res) => {
  const { nickname } = req.body ?? {};
  if (!nickname) return res.fail(400, "VAL_400", "nickname 필수");
  // basic policy: length 2-20
  if (nickname.length < 2 || nickname.length > 20) return res.fail(400, "VAL_400", "닉네임 길이 2~20");
  const exists = await query(`SELECT 1 FROM users WHERE nickname = $1`, [nickname]);
  if (exists.length) return res.fail(409, "NICKNAME_TAKEN", "이미 사용 중인 닉네임");
  await query(`UPDATE users SET nickname = $1, updated_at = NOW() WHERE id = $2`, [nickname, (req as any).user.uid]);
  return res.ok({ ok: true });
});

/** POST /api/v1/profile/region { regionCode, regionLabel } */
profileRouter.post("/profile/region", authRequired, async (req, res) => {
  const { regionCode, regionLabel } = req.body ?? {};
  if (!regionCode || !regionLabel) return res.fail(400, "VAL_400", "regionCode, regionLabel 필수");
  await query(`UPDATE users SET region_code = $1, region_label = $2, updated_at = NOW() WHERE id = $3`,
    [regionCode, regionLabel, (req as any).user.uid]);
  return res.ok({ ok: true });
});

