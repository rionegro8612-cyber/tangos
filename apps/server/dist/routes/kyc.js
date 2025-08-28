"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kycRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const age_1 = require("../lib/age");
const kyc_1 = require("../external/kyc");
const userRepo_1 = require("../repos/userRepo");
const router = (0, express_1.Router)();
exports.kycRouter = router;
/** POST /api/v1/auth/kyc/pass */
router.post("/api/v1/auth/kyc/pass", auth_1.authRequired, async (req, res, next) => {
    try {
        const { name, birth, carrier, phone } = req.body ?? {};
        if (!name || !birth || !carrier || !phone) {
            return res.fail("VAL_400", "name, birth(YYYYMMDD), carrier, phone 필수입니다.", 400);
        }
        const age = (0, age_1.calcAgeFromBirthYYYYMMDD)(birth);
        if (age < 0)
            return res.fail("VAL_400", "birth 형식은 YYYYMMDD 입니다.", 400);
        if (age < 50)
            return res.fail("KYC_AGE_RESTRICTED", "가입은 만 50세 이상부터 가능합니다.", 403);
        try {
            const result = await (0, kyc_1.verifyKyc)({ name, birth, carrier, phone });
            if (!result.ok) {
                const code = result.reason === "TEMPORARY_FAILURE" ? "KYC_TEMPORARY_FAILURE" : "KYC_MISMATCH";
                const status = result.reason === "TEMPORARY_FAILURE" ? 502 : 401;
                return res.fail(code, result.reason === "TEMPORARY_FAILURE" ? "KYC_TEMPORARY_FAILURE" : "KYC_MISMATCH", status);
            }
            const userId = String(req.user?.id);
            await (0, userRepo_1.updateKycStatus)(userId, result.provider);
            return res.ok({
                verified: true,
                provider: result.provider,
                checkedAt: new Date().toISOString(),
            });
        }
        catch (e) {
            next(e);
        }
    }
    catch (e) {
        next(e);
    }
});
