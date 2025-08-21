// tango-web/src/lib/api.ts

// 새로운 API_BASE 설정 (기존과 통합)
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4100/api/v1";

// 기존 API_BASE (하위 호환성 유지)
const API_BASE_LEGACY = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");

// 새로운 StandardResponse 타입 (기존과 통합)
export type StandardResponse<T = unknown> = {
  success: boolean;
  code: string;        // "OK" | "INVALID_..." | "RATE_LIMITED" 등
  message: string;
  data?: T;            // 선택적 필드로 변경 (기존 호환성)
  requestId?: string;  // 선택적 필드로 변경 (기존 호환성)
};

// 새로운 ApiError 클래스
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public requestId?: string,
    message?: string
  ) { super(message || code); }
}

// 기존 StandardResponse 타입 (하위 호환성 유지)
type StandardResponseLegacy<T = unknown> = {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  requestId?: string | null;
};

// 새로운 parse 함수
async function parse<T>(res: Response): Promise<StandardResponse<T>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON: ${text}`);
  }
}

// 새로운 api 함수
export async function api<T>(path: string, init: RequestInit = {}): Promise<StandardResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`,
    {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      ...init,
    }
  );
  const body = await parse<T>(res);
  if (!res.ok || body.success === false) {
    const m = body?.message || res.statusText;
    const err = new Error(m);
    (err as any).code = body?.code ?? `HTTP_${res.status}`;
    throw err;
  }
  return body;
}

// 새로운 apiFetch 함수 (기존과 병행)
export async function apiFetchNew<T>(input: RequestInfo, init?: RequestInit): Promise<StandardResponse<T>> {
  const res = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    },
    credentials: 'include', // 쿠키 기반 세션/토큰 사용시
  });

  const body = (await res.json()) as StandardResponse<T>;

  if (!res.ok || body.success === false) {
    throw new ApiError(body.code || String(res.status), res.status, body.requestId, body.message);
  }
  return body;
}

// 기존 함수들 (하위 호환성 유지)
function buildUrl(path: string) {
  // 절대 URL이면 그대로, 상대경로면 API_BASE 붙임(기본은 빈 문자열 → 같은 오리진)
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_LEGACY}${path}`;
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
  const json = await safeJson<StandardResponseLegacy<any>>(res);
  return { res, json };
}

/** 401이면 /auth/refresh 1회 시도 후 재요청 (엔드포인트 없으면 그냥 패스) */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<StandardResponseLegacy<T>> {
  const first = await raw(path, init);
  if (first.res.status !== 401) {
    // JSON이 아니어도 최소 형태로 맞춰 반환
    return (first.json as StandardResponseLegacy<T>) ?? ({ success: first.res.ok, data: null } as any);
  }

  // refresh 시도 (BFF에 없으면 404/널이어도 무시)
  const r = await raw("/api/v1/auth/refresh", { method: "POST" });
  if (r.res.ok && r.json?.success) {
    const again = await raw(path, init);
    return (again.json as StandardResponseLegacy<T>) ?? ({ success: again.res.ok, data: null } as any);
  }

  return (first.json as StandardResponseLegacy<T>) ?? ({ success: false, data: null } as any);
}

// ================= Auth =================

export async function sendSms(phone: string, opts?: { dev?: boolean }) {
  // ✅ dev는 쿼리 말고 body로 넘김 (BFF 라우트와 일치)
  return apiFetch<{ issued: boolean; ttlSec: number; devCode?: string }>(
    "/api/v1/auth/send-sms",
    { method: "POST", body: JSON.stringify({ phone, ...(opts?.dev ? { dev: true } : {}) }) },
  );
}

export async function verifyCode(phone: string, code: string) {
  return apiFetch<{ userId: string; autoLogin: boolean }>(
    "/api/v1/auth/verify-code",
    { method: "POST", body: JSON.stringify({ phone, code }) },
  );
}

export async function me() {
  // ✅ 백엔드 응답 형식에 맞춤
  return apiFetch<{ id: number; phone: string; nickname: string | null }>(
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

// 기존 api 함수 (하위 호환성 유지)
export async function apiLegacy(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (res.status === 401) {
    const r = await fetch(`/api/v1/auth/refresh`, { method: "POST", credentials: "include" });
    if (r.ok) {
      const retry = await fetch(`/api${path}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
        ...init,
      });
      const j2 = await retry.json().catch(() => ({}));
      if (retry.ok) return j2;
      throw j2;
    }
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw j;
  return j;
}
