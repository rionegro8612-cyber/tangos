import { Router } from "express";
import type { Request, Response } from "express";
import { query } from "../lib/db";
import { validate as uuidValidate } from "uuid";

const profileRouter = Router();

// 테스트 라우터
profileRouter.get("/test", (req, res) => {
  res.json({ message: "Profile router working!" });
});

// 닉네임 중복 체크
profileRouter.get("/nickname/check", async (req: Request, res: Response) => {
  try {
    const { value, userId } = req.query;
    
    // 🔍 디버깅 로그
    console.log(`[nickname/check] value: ${value}, userId: ${userId}, type: ${typeof userId}`);
    
    if (!value || typeof value !== "string") {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "닉네임 값이 필요합니다",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    const nickname = value.trim();

    // 닉네임 형식 검증: 2~12자, 한글/영문/숫자/_
    if (!/^[ㄱ-ㅎ가-힣A-Za-z0-9_]{2,12}$/.test(nickname)) {
      return res.json({
        success: true,
        code: "OK",
        data: { available: false, reason: "INVALID_FORMAT" },
        message: "닉네임 형식 오류(2~12자, 한글/영문/숫자/_)",
        requestId: (req as any).requestId ?? null,
      });
    }

    // 중복 체크 (자신 제외)
    let exists;
    if (userId && typeof userId === "string" && uuidValidate(userId)) {
      // userId가 제공된 경우: 자신 제외하고 중복 체크 (UUID인 경우)
      console.log(`[nickname/check] 자신 제외 체크: ${nickname}, userId: ${userId}`);
      exists = await query(`SELECT 1 FROM users WHERE nickname = $1 AND id != $2::uuid LIMIT 1`, [nickname, userId]);
    } else if (userId && typeof userId === "string" && !isNaN(Number(userId))) {
      // userId가 integer인 경우
      console.log(`[nickname/check] 자신 제외 체크 (integer): ${nickname}, userId: ${userId}`);
      exists = await query(`SELECT 1 FROM users WHERE nickname = $1 AND id != $2::integer LIMIT 1`, [nickname, userId]);
    } else {
      // userId가 없는 경우: 신규 사용자로 간주하여 전체 중복 체크
      console.log(`[nickname/check] 전체 중복 체크: ${nickname} (userId 없음)`);
      exists = await query(`SELECT 1 FROM users WHERE nickname = $1 LIMIT 1`, [nickname]);
    }

    const available = exists.rows.length === 0;

    return res.json({
      success: true,
      code: "OK",
      data: {
        available,
        reason: available ? null : "ALREADY_EXISTS",
      },
      message: available ? "사용 가능한 닉네임입니다" : "이미 사용 중인 닉네임입니다",
      requestId: (req as any).requestId ?? null,
    });
  } catch (e: any) {
    console.error("[profile/nickname/check] Error:", e);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: e?.message ?? "내부 오류가 발생했습니다",
      data: null,
      requestId: (req as any).requestId ?? null,
    });
  }
});

// 닉네임 설정
profileRouter.post("/nickname", async (req: Request, res: Response) => {
  try {
    const { nickname } = req.body ?? {};

    if (!nickname) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "nickname 필수",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 닉네임 형식 검증: 2~12자, 한글/영문/숫자/_
    if (!/^[ㄱ-ㅎ가-힣A-Za-z0-9_]{2,12}$/.test(nickname)) {
      return res.status(400).json({
        success: false,
        code: "BAD_REQUEST",
        message: "닉네임 형식 오류(2~12자, 한글/영문/숫자/_)",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 1) 인증 컨텍스트에서 우선 시도
    let userId = (req as any).user?.id ?? req.headers["x-user-id"] ?? req.body?.userId;

    // 2) 사용자 ID 검증 (UUID 또는 integer 모두 지원)
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "유효한 사용자 아이디가 필요합니다",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 3) 중복 체크 (자신 제외) - users.id 타입에 따라 다르게 처리
    let exists;
    if (typeof userId === "string" && uuidValidate(userId)) {
      // UUID 타입인 경우
      exists = await query(`SELECT 1 FROM users WHERE nickname = $1 AND id != $2::uuid LIMIT 1`, [nickname, userId]);
    } else if (typeof userId === "string" && !isNaN(Number(userId))) {
      // integer 타입인 경우
      exists = await query(`SELECT 1 FROM users WHERE nickname = $1 AND id != $2::integer LIMIT 1`, [nickname, userId]);
    } else {
      // 타입을 알 수 없는 경우 - 일반 비교 시도
      exists = await query(`SELECT 1 FROM users WHERE nickname = $1 AND id != $2 LIMIT 1`, [nickname, userId]);
    }

    if (exists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        code: "NICKNAME_TAKEN",
        message: "이미 사용 중인 닉네임",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 4) DB 업데이트 - users.id 타입에 따라 다르게 처리
    if (typeof userId === "string" && uuidValidate(userId)) {
      await query(`UPDATE users SET nickname = $1 WHERE id = $2::uuid RETURNING id`, [nickname, userId]);
    } else if (typeof userId === "string" && !isNaN(Number(userId))) {
      await query(`UPDATE users SET nickname = $1 WHERE id = $2::integer RETURNING id`, [nickname, userId]);
    } else {
      await query(`UPDATE users SET nickname = $1 WHERE id = $2 RETURNING id`, [nickname, userId]);
    }

    return res.json({
      success: true,
      code: "OK",
      data: { nickname },
      message: "닉네임이 저장되었습니다.",
      requestId: (req as any).requestId ?? null,
    });
  } catch (e: any) {
    console.error("[profile/nickname] Error:", e);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: e?.message ?? "내부 오류가 발생했습니다",
      data: null,
      requestId: (req as any).requestId ?? null,
    });
  }
});

// 지역 설정
profileRouter.post("/region", async (req: Request, res: Response) => {
  try {
    const { code, label, lat, lng, source } = req.body ?? {};
    
    // 1) 인증 컨텍스트에서 우선 시도
    let userId = (req as any).user?.id ?? req.headers["x-user-id"] ?? req.body?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "유효한 사용자 아이디가 필요합니다",
        data: null,
        requestId: (req as any).requestId ?? null,
      });
    }

    // 2) DB 업데이트 - users.id 타입에 따라 다르게 처리
    if (typeof userId === "string" && uuidValidate(userId)) {
      await query(`UPDATE users SET 
        region_code = $1, 
        region_label = $2, 
        region_lat = $3, 
        region_lng = $4, 
        region_source = $5
       WHERE id = $6::uuid`, [code ?? null, label ?? null, lat ?? null, lng ?? null, source ?? null, userId]);
    } else if (typeof userId === "string" && !isNaN(Number(userId))) {
      await query(`UPDATE users SET 
        region_code = $1, 
        region_label = $2, 
        region_lat = $3, 
        region_lng = $4, 
        region_source = $5
       WHERE id = $6::integer`, [code ?? null, label ?? null, lat ?? null, lng ?? null, source ?? null, userId]);
    } else {
      await query(`UPDATE users SET 
        region_code = $1, 
        region_label = $2, 
        region_lat = $3, 
        region_lng = $4, 
        region_source = $5
       WHERE id = $6`, [code ?? null, label ?? null, lat ?? null, lng ?? null, source ?? null, userId]);
    }

    return res.json({
      success: true,
      code: "OK",
      data: { code, label, lat, lng, source },
      message: "지역이 저장되었습니다.",
      requestId: (req as any).requestId ?? null,
    });
  } catch (e: any) {
    console.error("[profile/region] Error:", e);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: e?.message ?? "내부 오류가 발생했습니다",
      data: null,
      requestId: (req as any).requestId ?? null,
    });
  }
});

export default profileRouter;