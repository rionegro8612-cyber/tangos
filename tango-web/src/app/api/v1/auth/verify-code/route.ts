import { NextResponse } from "next/server";
import { signJwt } from "@/src/server/auth";

export async function POST(req: Request) {
  // 실제로는 req.body에서 phone, code 등을 받아서 검증해야 함
  // 아래는 예시용 간단 로직
  const { phone, code } = await req.json();

  // TODO: 실제 인증 코드 검증 로직을 여기에 구현
  const isValid = code === "123456"; // 예시: 항상 123456만 통과
  if (!isValid) {
    return NextResponse.json({ success: false, message: "인증 실패" }, { status: 401 });
  }

  // 인증 성공 시 JWT 발급 및 쿠키 설정
  const token = signJwt({ phone });
  const res = NextResponse.json({ success: true });
  res.cookies.set("tango_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // 개발환경에서는 false
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
