import { NextResponse } from "next/server";
import { signJwt } from "@/server/auth";

export async function POST(req: Request) {
  // 공통 응답 유틸
  const json = (body: any, status = 200) =>
    NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

  // 1) JSON 파싱 예외 방어
  let phone: string | undefined;
  let code: string | undefined;
  try {
    const body = await req.json();
    phone = typeof body?.phone === "string" ? body.phone : undefined;
    code = typeof body?.code === "string" ? body.code : undefined;
  } catch {
    return json({ success: false, code: "BAD_JSON", message: "invalid JSON body" }, 400);
  }

  // 2) 입력 검증
  if (!phone || !code) {
    return json({ success: false, code: "INVALID_ARG", message: "phone, code required" }, 400);
  }
  // 숫자 6자리 형태 권장 (정책에 맞게 조정)
  if (!/^\d{6}$/.test(code)) {
    return json({ success: false, code: "INVALID_CODE", message: "code must be 6 digits" }, 400);
  }

  // 3) OTP 검증 (임시)
  // TODO: 실제 검증은 서버(4100)의 저장소/DB와 대조해야 합니다.
  // - 프록시를 써서 같은 오리진(/api/v1/...) 호출이면 CORS 문제 없음
  // - 여기선 기존 더미 로직 유지하되, 환경변수로 제어 가능하게 변경
  const DEV_ACCEPT = process.env.DEBUG_OTP === "1" ? code : "123456";
  const isValid = code === DEV_ACCEPT;

  if (!isValid) {
    return json({ success: false, code: "OTP_INVALID", message: "인증 실패" }, 401);
  }

  // 4) JWT 발급 및 쿠키 설정
  // - signJwt는 .env.local의 JWT_SECRET을 사용 (이미 설정 완료)
  const token = signJwt({ phone });

  const res = json({ success: true }, 200);
  res.cookies.set("tango_session", token, {
    httpOnly: true,
    sameSite: "lax", // 프록시로 같은 오리진이면 lax로 충분
    secure: false,   // 로컬 http
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
