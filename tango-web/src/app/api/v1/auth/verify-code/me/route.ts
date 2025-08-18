import { NextResponse } from "next/server";
import { readToken } from "@/src/server/auth/cookies";
import { verifyAccess } from "@/src/server/auth/jwt";

export async function GET() {
  try {
    const token = await readToken();
    if (!token) {
      return NextResponse.json({ success: false, code: "UNAUTHORIZED", message: "missing token", data: null }, { status: 401 });
    }
    const { user } = verifyAccess(token);
    return NextResponse.json({ success: true, data: { user } });
  } catch {
    return NextResponse.json({ success: false, code: "UNAUTHORIZED", message: "invalid token", data: null }, { status: 401 });
  }
}
