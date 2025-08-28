"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyKyc = verifyKyc;
async function callPASS(_req) {
    // TODO: 실제 PASS 연동
    return { ok: true, provider: "PASS", providerTraceId: "pass-" + Date.now() };
}
async function callNICE(_req) {
    // TODO: 실제 NICE 연동
    return { ok: true, provider: "NICE", providerTraceId: "nice-" + Date.now() };
}
async function verifyKyc(req) {
    try {
        const r1 = await callPASS(req);
        if (r1.ok)
            return r1;
        const r2 = await callNICE(req);
        return r2;
    }
    catch {
        try {
            return await callNICE(req);
        }
        catch { }
        return { ok: false, provider: "PASS", reason: "TEMPORARY_FAILURE" };
    }
}
