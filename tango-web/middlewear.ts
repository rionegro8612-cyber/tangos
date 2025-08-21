import { NextRequest, NextResponse } from "next/server";

const PROTECT = ["/onboarding", "/profile"];   // 로그인 필수 구간
const PUBLIC  = ["/register", "/login"];       // 비로그인 전용(선택)

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;
  const hasAT = req.cookies.has("access_token");

  // 보호 라우트: 비로그인이면 로그인/시작으로
  if (PROTECT.some(p => path.startsWith(p))) {
    if (!hasAT) {
      url.pathname = "/register/start";
      return NextResponse.redirect(url);
    }
  }

  // 공개 라우트: 이미 로그인인데 접근하면 홈으로
  if (PUBLIC.some(p => path.startsWith(p))) {
    if (hasAT) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
