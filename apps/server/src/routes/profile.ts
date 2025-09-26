import { Router } from "express";
import { validate as uuidValidate } from "uuid";
import { query } from "../lib/db";

const profileRouter = Router();

// 닉네임 중복 체크
profileRouter.get("/nickname/check", async (req, res) => {
  try {
    const { value, userId } = req.query;
    
    // 🔍 디버깅 로그 추가
    console.log(`[nickname/check] value: ${value}, userId: ${userId}, type: ${typeof userId}`);
    
    if (!value || typeof value !== "string") {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "닉네임 값이 필요합니다",
      });
    }

    const nickname = value.trim();

    // 닉네임 형식 검증: 2~12자, 한글/영문/숫자/_
    if (!/^[ㄱ-ㅎ가-힣A-Za-z0-9_]{2,12}$/.test(nickname)) {
      return res.json({
        success: true,
        data: { available: false, reason: "INVALID_FORMAT" },
        message: "닉네임 형식 오류(2~12자, 한글/영문/숫자/_)",
      });
    }

    // 중복 체크 (자신 제외)
    let exists;
    if (userId && typeof userId === "string" && uuidValidate(userId)) {
      // userId가 제공된 경우: 자신 제외하고 중복 체크
      console.log(`[nickname/check] 자신 제외 체크: ${nickname}, userId: ${userId}`);
      exists = await query(`SELECT 1 FROM users WHERE nickname = $1 AND id != $2::uuid LIMIT 1`, [nickname, userId]);
    } else {
      // userId가 없는 경우: 신규 사용자로 간주하여 전체 중복 체크
      console.log(`[nickname/check] 전체 중복 체크: ${nickname} (userId 없음)`);
      exists = await query(`SELECT 1 FROM users WHERE nickname = $1 LIMIT 1`, [nickname]);
    }

    const available = exists.rows.length === 0;

    return res.json({
      success: true,
      data: {
        available,
        reason: available ? null : "ALREADY_EXISTS",
      },
      message: available ? "사용 가능한 닉네임입니다" : "이미 사용 중인 닉네임입니다",
    });
  } catch (e: any) {
    console.error("[profile/nickname/check] Error:", e);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: e.message ?? "내부 오류가 발생했습니다",
    });
  }
});

// 닉네임 설정
profileRouter.post("/nickname", async (req, res) => {
  try {
    const { nickname } = req.body ?? {};
    if (!nickname)
      return res.status(400).json({
        success: false,
        code: "VAL_400",
        message: "nickname 필수",
      });

    // 닉네임 형식 검증: 2~12자, 한글/영문/숫자/_
    if (!/^[ㄱ-ㅎ가-힣A-Za-z0-9_]{2,12}$/.test(nickname)) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "닉네임 형식 오류(2~12자, 한글/영문/숫자/_)",
      });
    }

    // 1) 인증 컨텍스트에서 우선 시도
    let userId: unknown = (req as any).user?.id ?? req.headers["x-user-id"] ?? req.body?.userId;

    // 2) UUID 검증 (절대 Number/parseInt 금지)
    if (typeof userId !== "string" || !uuidValidate(userId)) {
      return res.status(401).json({
        success: false,
        code: "NO_AUTH",
        message: "유효한 사용자 아이디가 필요합니다",
      });
    }

    // 3) 중복 체크 (자신 제외)
    const exists = await query(`SELECT 1 FROM users WHERE nickname = $1 AND id != $2::uuid`, [
      nickname,
      userId,
    ]);
    if (exists.rows.length)
      return res.status(409).json({
        success: false,
        code: "NICKNAME_TAKEN",
        message: "이미 사용 중인 닉네임",
      });

    // 4) DB 업데이트 (문자열 바인딩 → ::uuid 캐스팅)
    await query(`UPDATE users SET nickname = $1 WHERE id = $2::uuid`, [nickname, userId]);

    return res.json({
      success: true,
      data: { nickname },
      message: "닉네임이 저장되었습니다.",
    });
  } catch (e: any) {
    console.error("[profile/nickname] Error:", e);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: e.message ?? "내부 오류가 발생했습니다",
    });
  }
});

// 지역 설정
profileRouter.post("/region", async (req, res) => {
  try {
    const { code, label, lat, lng, source } = req.body ?? {};

    // 1) 인증 컨텍스트에서 우선 시도
    let userId: unknown = (req as any).user?.id ?? req.headers["x-user-id"] ?? req.body?.userId;

    // 2) UUID 검증 (절대 Number/parseInt 금지)
    if (typeof userId !== "string" || !uuidValidate(userId)) {
      return res.status(401).json({
        success: false,
        code: "NO_AUTH",
        message: "유효한 사용자 아이디가 필요합니다",
      });
    }

    // 3) DB 업데이트 (문자열 바인딩 → ::uuid 캐스팅)
    await query(
      `UPDATE users SET 
        region_code = $1, 
        region_label = $2, 
        region_lat = $3, 
        region_lng = $4, 
        region_source = $5
       WHERE id = $6::uuid`,
      [code ?? null, label ?? null, lat ?? null, lng ?? null, source ?? null, userId],
    );

    return res.json({
      success: true,
      data: { code, label, lat, lng, source },
      message: "지역이 저장되었습니다.",
    });
  } catch (e: any) {
    console.error("[profile/region] Error:", e);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: e.message ?? "내부 오류가 발생했습니다",
    });
  }
});

export default profileRouter;
