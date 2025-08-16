import { Response } from 'express';

const domain = process.env.COOKIE_DOMAIN || 'localhost';
const secure = String(process.env.COOKIE_SECURE || 'false') === 'true';

const base = {
  httpOnly: true as const,
  secure,                 // 프로덕션에선 true (HTTPS 필요)
  sameSite: 'lax' as const,
  domain,
  path: '/',
};

export function setAuthCookies(res: Response, at: string, rt?: string) {
  // Access: 30분
  res.cookie('at', at, { ...base, maxAge: 30 * 60 * 1000 });
  // Refresh: 30일
  if (rt) res.cookie('rt', rt, { ...base, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('at', { ...base });
  res.clearCookie('rt', { ...base });
}
