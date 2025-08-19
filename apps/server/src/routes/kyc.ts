import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authRequired } from "../middlewares/auth";
import { calcAgeFromBirthYYYYMMDD } from "../lib/age";
import { verifyKyc } from "../external/kyc";
import { updateKycStatus } from "../repos/userRepo";

const router = Router();

/** POST /api/v1/auth/kyc/pass */
router.post("/api/v1/auth/kyc/pass", authRequired, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, birth, carrier, phone } = req.body ?? {};
    if (!name || !birth || !carrier || !phone) {
      return res.fail(400, "VAL_400", "name, birth(YYYYMMDD), carrier, phone 필수입니다.");
    }

    const age = calcAgeFromBirthYYYYMMDD(birth);
    if (age < 0) return res.fail(400, "VAL_400", "birth 형식은 YYYYMMDD 입니다.");
    if (age < 50) return res.fail(403, "KYC_AGE_RESTRICTED", "가입은 만 50세 이상부터 가능합니다.");

    const result = await verifyKyc({ name, birth, carrier, phone });
    if (!result.ok) {
      const code = result.reason === "TEMPORARY_FAILURE" ? 502 : 401;
      return res.fail(code, result.reason === "TEMPORARY_FAILURE" ? "KYC_TEMPORARY_FAILURE" : "KYC_MISMATCH",
        result.reason === "TEMPORARY_FAILURE" ? "외부 연동 장애" : "본인정보 불일치");
    }

    const userId = (req as any).user?.uid;
    await updateKycStatus(Number(userId), result.provider);

    return res.ok({
      verified: true,
      provider: result.provider,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

export { router as kycRouter };
