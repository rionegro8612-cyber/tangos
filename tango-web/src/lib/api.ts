// tango-web/src/lib/api.ts

// 통일된 API_BASE 설정 (백엔드 서버 직접 호출)
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL || 
  "http://localhost:4100"
).replace(/\/+$/, "") + "/api/v1";

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
  // 백엔드 서버로 직접 요청
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
  const json = await safeJson<StandardResponseLegacy<any>>(res);
  return { res, json };
}

/** 백엔드 직접 호출로 통일된 apiFetch */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<StandardResponseLegacy<T>> {
  try {
    // 백엔드 서버로 직접 요청
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      ...init,
    });
    
    if (res.status === 401) {
      // refresh 시도
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, { 
          method: "POST",
          credentials: "include"
        });
        
        if (refreshRes.ok) {
          // refresh 성공 시 원래 요청 재시도
          const retryRes = await fetch(`${API_BASE}${path}`, {
            credentials: "include",
            headers: { "Content-Type": "application/json", ...(init.headers || {}) },
            ...init,
          });
          
          const retryJson = await safeJson<StandardResponseLegacy<T>>(retryRes);
          return retryJson ?? ({ success: retryRes.ok, data: null } as any);
        }
      } catch {
        // refresh 실패 시 무시
      }
    }
    
    const json = await safeJson<StandardResponseLegacy<T>>(res);
    return json ?? ({ success: res.ok, data: null } as any);
  } catch (error) {
    return { success: false, data: null } as any;
  }
}

// ================= Auth =================

export async function sendSms(phone: string, opts?: { dev?: boolean }) {
  // ✅ 백엔드 서버로 직접 요청 (BFF 우회)
  const res = await fetch(`${API_BASE}/auth/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: 'include',
    body: JSON.stringify({ phone, carrier: "LG", context: "signup", ...(opts?.dev ? { dev: true } : {}) }),
  });
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  const json = await res.json();
  return json;
}

export async function verifyCode(phone: string, code: string) {
  // ✅ 백엔드 서버로 직접 요청 (BFF 우회)
  const res = await fetch(`${API_BASE}/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: 'include',
    body: JSON.stringify({ phone, code, context: "signup" }),
  });
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  const json = await res.json();
  return json;
}

export async function signup(phone: string, code: string) {
  // ✅ 백엔드 서버로 직접 요청 (BFF 우회)
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: 'include',
    body: JSON.stringify({ phone, code, context: "signup" }),
  });
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  const json = await res.json();
  return json;
}

export async function me() {
  // ✅ 백엔드 서버로 직접 요청 (BFF 우회)
  const res = await fetch(`${API_BASE}/auth/me`, {
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  const json = await res.json();
  return json;
}

export async function logout() {
  // ✅ 백엔드 서버로 직접 요청 (BFF 우회)
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  const json = await res.json();
  return json;
}

// ================= User =================
export async function updateProfile(nickname: string | null) {
  // ✅ 백엔드 서버로 직접 요청 (BFF 우회)
  const res = await fetch(`${API_BASE}/user/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: 'include',
    body: JSON.stringify({ nickname }),
  });
  
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  const json = await res.json();
  return json;
}

// ================= 하위 호환성 함수들 (점진적 제거 예정) =================
// ⚠️ 새로운 코드에서는 사용하지 말고 위의 직접 호출 함수들을 사용하세요

export async function apiLegacy(path: string, init?: RequestInit) {
  console.warn('[DEPRECATED] apiLegacy is deprecated. Use direct backend calls instead.');
  
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (res.status === 401) {
    const r = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    if (r.ok) {
      const retry = await fetch(`${API_BASE}${path}`, {
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
