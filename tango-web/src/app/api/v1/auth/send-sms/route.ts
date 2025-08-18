import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { phone, dev } = await req.json().catch(() => ({}));
  if (!phone) {
    return NextResponse.json({ success: false, code: "BAD_REQUEST", message: "phone required", data: null }, { status: 400 });
  }
  // 실제로는 SMS 발송 로직 호출
  const devCode = dev ? "123456" : undefined;
  return NextResponse.json({ success: true, data: { phoneE164: phone, expiresInSec: 180, devCode } });
}
