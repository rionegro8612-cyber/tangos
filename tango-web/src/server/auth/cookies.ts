import { cookies } from "next/headers";

export const ACCESS_COOKIE = "access_token";

export async function setSessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production";
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax", // 개발은 lax
    secure,                             // 개발은 false
    maxAge: 60 * 30, // 30분
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
}

export async function readToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_COOKIE)?.value ?? null;
}
