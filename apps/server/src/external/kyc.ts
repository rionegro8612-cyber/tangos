// apps/server/src/external/kyc.ts
export type KycRequest = {
  name: string;
  birth: string; // YYYYMMDD
  carrier: "SKT" | "KT" | "LGU+" | "알뜰폰";
  phone: string; // +8210...
};
export type KycResult = {
  ok: boolean;
  provider: "PASS" | "NICE";
  providerTraceId?: string;
  reason?: "TEMPORARY_FAILURE" | "MISMATCH";
};

async function callPASS(_req: KycRequest): Promise<KycResult> {
  // TODO: 실제 PASS 연동
  return { ok: true, provider: "PASS", providerTraceId: "pass-" + Date.now() };
}
async function callNICE(_req: KycRequest): Promise<KycResult> {
  // TODO: 실제 NICE 연동
  return { ok: true, provider: "NICE", providerTraceId: "nice-" + Date.now() };
}

export async function verifyKyc(req: KycRequest): Promise<KycResult> {
  try {
    const r1 = await callPASS(req);
    if (r1.ok) return r1;
    const r2 = await callNICE(req);
    return r2;
  } catch {
    try {
      return await callNICE(req);
    } catch {}
    return { ok: false, provider: "PASS", reason: "TEMPORARY_FAILURE" };
  }
}
