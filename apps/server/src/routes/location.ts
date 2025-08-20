import { Router } from "express";
import { searchLocation } from "../services/location";

const router = Router();

// 위치 검색 API
router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "");
    if (!q.trim()) {
      return res.fail(400, "BAD_REQUEST", "q 파라미터가 필요합니다");
    }
    
    const items = await searchLocation(q);
    
    // 프론트 표준화: label/code/lat/lng
    const normalized = items.map(it => ({
      label: it.label,
      code: it.code ?? null,
      lat: it.lat ?? null,
      lng: it.lng ?? null,
      source: it.source
    }));
    
    return res.ok({ items: normalized }, "OK");
  } catch (error) {
    console.error("[location] 검색 오류:", error);
    return res.fail(500, "INTERNAL_ERROR", "위치 검색 중 오류가 발생했습니다");
  }
});

// 선택 결과 저장 (유저 바인딩은 인증 미들웨어 뒤에서 처리)
router.post("/code", async (req, res) => {
  try {
    const { label, code, lat, lng } = req.body || {};
    if (!label) {
      return res.fail(400, "BAD_REQUEST", "label이 필요합니다");
    }
    
    // TODO: users.profile.region_code / region_label 업데이트 (트랜잭션)
    // 현재는 성공 응답만 반환
    return res.ok({ saved: true }, "OK");
  } catch (error) {
    console.error("[location] 저장 오류:", error);
    return res.fail(500, "INTERNAL_ERROR", "위치 정보 저장 중 오류가 발생했습니다");
  }
});

export { router as locationRouter };
