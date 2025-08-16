// tango-web/src/lib/api.ts
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "http://127.0.0.1:4100";

type StandardResponse<T = unknown> = {
  success: boolean;
  code: string;
  message: string;
  data: T;
  requestId?: string | null;
};

async function raw(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  const json = (await res.json()) as StandardResponse<any>;
  return { res, json };
}

/** 401 이면 /auth/refresh 1회 시도 후 재요청 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<StandardResponse<T>> {
  const first = await raw(path, init);
  if (first.res.status !== 401) return first.json as StandardResponse<T>;

  // refresh 1회
  const r = await raw("/api/v1/auth/refresh", { method: "POST" });
  if (!r.json?.success) return first.json as StandardResponse<T>;

  const again = await raw(path, init);
  return again.json as StandardResponse<T>;
}

// -------- Auth ----------
export async function sendSms(
  phone: string,
  opts?: { dev?: boolean }
) {
  const q = opts?.dev ? "?dev=1" : "";
  return apiFetch<{ phoneE164: string; expiresInSec: number; devCode?: string }>(
    `/api/v1/auth/send-sms${q}`,
    { method: "POST", body: JSON.stringify({ phone }) },
  );
}

export async function verifyCode(phone: string, code: string) {
  return apiFetch<{ userId: number; accessToken?: string; refreshToken?: string }>(
    "/api/v1/auth/verify-code",
    { method: "POST", body: JSON.stringify({ phone, code }) },
  );
}

export async function me() {
  return apiFetch<{ user: { id: string; phone_e164_norm: string; nickname: string | null } }>(
    "/api/v1/auth/me",
  );
}

export async function logout() {
  return apiFetch("/api/v1/auth/logout", { method: "POST" });
}

// -------- User ----------
export async function updateProfile(nickname: string | null) {
  return apiFetch<{ user: { id: string; phone_e164_norm: string; nickname: string | null } }>(
    "/api/v1/user/profile",
    { method: "POST", body: JSON.stringify({ nickname }) },
  );
}

