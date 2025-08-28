"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/server/src/routes/kyc.mvp.ts
const express_1 = require("express");
const db_1 = require("../db"); // <- 프로젝트의 query 래퍼를 그대로 사용
const passClient_1 = require("../lib/vendors/passClient");
const niceClient_1 = require("../lib/vendors/niceClient");
const router = (0, express_1.Router)();
/** YYYYMMDD → 만 나이 계산 (UTC 기준) */
function calcAge(birthYmd) {
    if (!/^\d{8}$/.test(birthYmd))
        return null;
    const y = Number(birthYmd.slice(0, 4));
    const m = Number(birthYmd.slice(4, 6)) - 1; // 0-based
    const d = Number(birthYmd.slice(6, 8));
    const dob = new Date(Date.UTC(y, m, d));
    if (Number.isNaN(dob.getTime()))
        return null;
    const now = new Date();
    let age = now.getUTCFullYear() - y;
    const month = now.getUTCMonth();
    const day = now.getUTCDate();
    if (month < m || (month === m && day < d))
        age--;
    return age;
}
/**
 * 최종 경로: POST /api/v1/auth/kyc/pass
 * (주의) 여기서는 "/kyc/pass" 만 선언하고, 바깥에서 "/auth" 접두를 붙입니다.
 */
router.post("/kyc/pass", async (req, res) => {
    const rid = req.id;
    try {
        const { name = "", birth = "", phone = "", carrier = "" } = (req.body || {});
        // 기본 파라미터 체크
        if (!name || !birth || !phone || !carrier) {
            return res.status(400).json({
                success: false,
                code: "INVALID_ARG",
                message: "name, birth, phone, carrier required",
                data: null,
                requestId: rid,
            });
        }
        // 생년월일 유효성 + 만 나이
        const age = calcAge(birth);
        if (age === null) {
            return res.status(400).json({
                success: false,
                code: "INVALID_BIRTH",
                message: "birth must be YYYYMMDD",
                data: null,
                requestId: rid,
            });
        }
        const minAge = Number(process.env.KYC_MIN_AGE || 50);
        // 1차 PASS 시도 → 실패(예외) 또는 미검증이면 NICE 시도
        let verified = false;
        let provider = "PASS";
        let providerTraceId = "";
        try {
            const r1 = await (0, passClient_1.verifyPASS)({ name, birth, phone, carrier });
            verified = !!r1?.verified;
            providerTraceId = String(r1?.providerTraceId || "");
        }
        catch {
            verified = false;
        }
        if (!verified) {
            try {
                const r2 = await (0, niceClient_1.verifyNICE)({ name, birth, phone, carrier });
                verified = !!r2?.verified;
                provider = "NICE";
                providerTraceId = String(r2?.providerTraceId || "");
            }
            catch {
                verified = false;
            }
        }
        if (!verified) {
            return res.status(403).json({
                success: false,
                code: "KYC_FAILED",
                message: "본인인증에 실패했습니다.",
                data: null,
                requestId: rid,
            });
        }
        // 연령 제한
        if (age < minAge) {
            return res.status(403).json({
                success: false,
                code: "KYC_AGE_RESTRICTED",
                message: `가입은 만 ${minAge}세 이상부터 가능합니다.`,
                data: null,
                requestId: rid,
            });
        }
        // DB 업데이트
        // - 스키마가 프로젝트마다 다를 수 있어 넓게 호환:
        //   is_kyc_verified / kyc_verified_at 를 쓰는 경우 + kyc_provider 기록
        const sql = `UPDATE users
         SET is_kyc_verified = TRUE,
             kyc_verified_at = NOW(),
             kyc_provider = $2
       WHERE phone_e164_norm = $1`;
        const params = [phone, provider];
        const result = await (0, db_1.query)(sql, params);
        const affected = typeof result?.rowCount === "number"
            ? result.rowCount
            : Array.isArray(result)
                ? result.length
                : 0;
        if (affected === 0) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "user not found for phone",
                data: null,
                requestId: rid,
            });
        }
        return res.status(200).json({
            success: true,
            code: "OK",
            message: "kyc verified",
            data: { provider, providerTraceId, age },
            requestId: rid,
        });
    }
    catch (err) {
        return res.status(502).json({
            success: false,
            code: "KYC_PROVIDER_ERROR",
            message: String(err?.message || "KYC error"),
            data: null,
            requestId: req.id,
        });
    }
});
// /api/v1/auth/kyc/ping 헬스체크 라우트
router.get("/kyc/ping", (req, res) => {
    res.status(200).json({ success: true, message: "kyc pong" });
});
exports.default = router;
