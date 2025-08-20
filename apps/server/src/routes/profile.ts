
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
  
  // 닉네임 형식 검증: 2~12자, 한/영/숫자/_
  if (!/^[\w가-힣]{2,12}$/.test(nickname)) {
    return res.fail(400, "BAD_REQUEST", "닉네임 형식 오류(2~12자, 한/영/숫자/_)");
  }
  
  // 중복 체크 (자신 제외)
  const exists = await query(
    `SELECT 1 FROM users WHERE nickname = $1 AND id != $2`, 
    [nickname, (req as any).user.id]
  );
  if (exists.length) return res.fail(409, "NICKNAME_TAKEN", "이미 사용 중인 닉네임");
  
  await query(
    `UPDATE users SET nickname = $1, updated_at = NOW() WHERE id = $2`, 
    [nickname, (req as any).user.id]
  );
  return res.ok({ success: true }, "닉네임이 저장되었습니다.");
});

/** POST /api/v1/profile/region { label, code?, lat?, lng? } */
profileRouter.post("/profile/region", authRequired, async (req, res) => {
  const { label, code, lat, lng } = req.body ?? {};
  if (!label) return res.fail(400, "BAD_REQUEST", "label 필수");
  
  await query(
    `UPDATE users SET 
      region_label = $1, 
      region_code = $2, 
      region_lat = $3, 
      region_lng = $4,
      updated_at = NOW()
     WHERE id = $5`,
    [
      String(label),
      code ? String(code) : null,
      lat ?? null,
      lng ?? null,
      (req as any).user.id
    ]
  );
  return res.ok({ success: true }, "지역 정보가 저장되었습니다.");
});

