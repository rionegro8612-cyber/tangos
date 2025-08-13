import { NextResponse } from "next/server";
import { verifyCode } from "@/server/auth/sms/service";
import { signJwt, setSessionCookie } from "@/server/auth";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { phone, code, purpose = "login" } = await req.json();
    if (!phone || !code) return NextResponse.json({ success:false, code:"VALIDATION_ERROR", message:"phone and code are required", data:null, requestId }, { status:400 });

    const r = await verifyCode(phone, purpose, code);
    if (!r.ok) {
      const map:any = {
        NO_ACTIVE_CODE: { s:400, c:"NO_ACTIVE_CODE", m:"No valid code. Request again." },
        EXPIRED:       { s:400, c:"OTP_EXPIRED",   m:"Code expired." },
        MISMATCH:      { s:401, c:"INVALID_CODE",  m:"Invalid code." },
        LOCKED:        { s:429, c:"OTP_LOCKED",    m:"Too many attempts. Try later." },
      };
      const m = map[(r as any).reason] ?? { s:400, c:"INVALID", m:"Invalid request." };
      return NextResponse.json({ success:false, code:m.c, message:m.m, data:null, requestId }, { status:m.s });
    }

    // 성공 → JWT 발급 + 세션 쿠키 세팅
    const userId = "u_" + Buffer.from(String(phone)).toString("base64url");
    const accessToken = signJwt({ sub: userId });
    const res = NextResponse.json({ success:true, code:"OK", message:"Verified", data:{ accessToken, userId }, requestId });
    setSessionCookie(res, accessToken);
    return res;
  } catch (e:any) {
    return NextResponse.json({ success:false, code:"INTERNAL_ERROR", message:e?.message ?? "Unexpected error", data:null, requestId }, { status:500 });
  }
}