"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kycCheck = kycCheck;
const mode = (process.env.KYC_MODE || "STUB").toUpperCase();
async function kycCheck(input) {
    if (mode === "STUB") {
        const y = Number(input.birth.slice(0, 4));
        const age = new Date().getFullYear() - y;
        if (age < 50)
            return { ok: false, reason: "AGE" };
        return { ok: true };
    }
    if (mode === "PASS") {
        try {
            // TODO: PASS 실연동 (통신3사 본인확인 API)
            // 요청/응답 스키마 맵핑 후 불일치 → MISMATCH, 일시장애 → TEMP
            // const resp = await fetch(PASS_URL, { method:"POST", headers:{...}, body: JSON.stringify({...input}) });
            // const j = await resp.json();
            // return { ok: j.ok, reason: j.reasonMap };
            return { ok: true }; // 임시
        }
        catch {
            return { ok: false, reason: "TEMP" };
        }
    }
    if (mode === "NICE") {
        try {
            // TODO: NICE 실연동
            return { ok: true }; // 임시
        }
        catch {
            return { ok: false, reason: "TEMP" };
        }
    }
    return { ok: false, reason: "TEMP" };
}
