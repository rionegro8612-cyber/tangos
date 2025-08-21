import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // access_token 쿠키 존재만 빠르게 체크(실검증은 페이지에서)
  const hasAuth = req.cookies.get('access_token');
  const url = req.nextUrl;

  if (hasAuth && url.pathname.startsWith('/login')) {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/login'],
};
