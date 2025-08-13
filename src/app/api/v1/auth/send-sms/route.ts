import { NextResponse } from "next/server";
import { requestCode } from "@/server/auth/sms/service";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { phone, purpose = "login" } = await req.json();
    if (!phone) return NextResponse.json({ success:false, code:"VALIDATION_ERROR", message:"phone is required", data:null, requestId }, { status:400 });

    const r = await requestCode(phone, purpose);
    if (!r.ok) return NextResponse.json({ success:false, code:"RATE_LIMIT", message:"Too many requests. Try again shortly.", data:{ retryAfterSec: r.retryAfterSec ?? 60 }, requestId }, { status:429 });

    return NextResponse.json({ success:true, code:"OK", message:"SMS sent", data:{ phoneE164: r.phoneE164, expiresInSec: r.expiresInSec }, requestId });
  } catch (e:any) {
    return NextResponse.json({ success:false, code:"INTERNAL_ERROR", message:e?.message ?? "Unexpected error", data:null, requestId }, { status:500 });
  }
}
