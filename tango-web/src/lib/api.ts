// tango-web/src/lib/api.ts

// 기본은 "같은 오리진"(= Next.js dev 서버 3000)
// 서버(4100)로 직접 붙이고 싶으면 .env.local에 NEXT_PUBLIC_API_BASE_URL=... 넣으세요.
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");

type StandardResponse<T = unknown> = {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  requestId?: string | null;
};

function buildUrl(path: string) {
  // 절대 URL이면 그대로, 상대경로면 API_BASE 붙임(기본은 빈 문자열 → 같은 오리진)
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

function isJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  return ct.toLowerCase().includes("application/json");
}

async function safeJson<T = any>(res: Response): Promise<T | null> {
  if (res.status === 204) return null;
  try {
    if (!isJson(res)) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function raw(path: string, init: RequestInit = {}) {
  const res = await fetch(buildUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  const json = await safeJson<StandardResponse<any>>(res);
  return { res, json };
}

/** 401이면 /auth/refresh 1회 시도 후 재요청 (엔드포인트 없으면 그냥 패스) */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<StandardResponse<T>> {
  const first = await raw(path, init);
  if (first.res.status !== 401) {
    // JSON이 아니어도 최소 형태로 맞춰 반환
    return (first.json as StandardResponse<T>) ?? ({ success: first.res.ok, data: null } as any);
  }

  // refresh 시도 (BFF에 없으면 404/널이어도 무시)
  const r = await raw("/api/v1/auth/refresh", { method: "POST" });
  if (r.res.ok && r.json?.success) {
    const again = await raw(path, init);
    return (again.json as StandardResponse<T>) ?? ({ success: again.res.ok, data: null } as any);
  }

  return (first.json as StandardResponse<T>) ?? ({ success: false, data: null } as any);
}

// ================= Auth =================

export async function sendSms(phone: string, opts?: { dev?: boolean }) {
  // ✅ dev는 쿼리 말고 body로 넘김 (BFF 라우트와 일치)
  return apiFetch<{ phoneE164: string; expiresInSec: number; devCode?: string }>(
    "/api/v1/auth/send-sms",
    { method: "POST", body: JSON.stringify({ phone, ...(opts?.dev ? { dev: true } : {}) }) },
  );
}

export async function verifyCode(phone: string, code: string) {
  return apiFetch<{ user?: { id: string; phone_e164_norm: string; nickname: string | null } }>(
    "/api/v1/auth/verify-code",
    { method: "POST", body: JSON.stringify({ phone, code }) },
  );
}

export async function me() {
  // BFF 기준 경로
  return apiFetch<{ user: { id: string; phone_e164_norm: string; nickname: string | null } }>(
    "/api/v1/auth/me",
  );
}

export async function logout() {
  return apiFetch("/api/v1/auth/logout", { method: "POST" });
}

// ================= User =================
// (이건 BFF에 없으면 4100 서버로 보낼 수 있도록 .env로 API_BASE를 세팅해서 사용)
export async function updateProfile(nickname: string | null) {
  return apiFetch<{ user: { id: string; phone_e164_norm: string; nickname: string | null } }>(
    "/api/v1/user/profile",
    { method: "POST", body: JSON.stringify({ nickname }) },
  );
}
