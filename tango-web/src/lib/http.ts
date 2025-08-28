// tango-web/src/lib/http.ts

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";

// 표준 응답 타입
export type StandardResponse<T = unknown> = {
  success: boolean;
  code: string;
  message: string;
  data?: T;
  requestId?: string;
};

// API 에러 클래스
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public requestId?: string,
    message?: string
  ) {
    super(message || code);
  }
}

// 통합 API 함수
export async function api<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<StandardResponse<T>> {
  const url = `${BASE}${path}`;
  
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  // 표준 응답 포맷 파싱
  const json = await response.json().catch(() => ({}));
  
  if (!response.ok || json?.success === false) {
    const code = json?.code ?? `HTTP_${response.status}`;
    const message = json?.message ?? "요청이 실패했습니다.";
    throw new ApiError(code, response.status, json?.requestId, message);
  }

  return json as StandardResponse<T>;
}

// GET 요청 헬퍼
export async function apiGet<T = unknown>(path: string): Promise<StandardResponse<T>> {
  return api<T>(path, { method: "GET" });
}

// POST 요청 헬퍼
export async function apiPost<T = unknown>(
  path: string,
  data?: unknown
): Promise<StandardResponse<T>> {
  return api<T>(path, {
    method: "POST",
    body: data ? JSON.stringify(data) : null,
  });
}

// PUT 요청 헬퍼
export async function apiPut<T = unknown>(
  path: string,
  data?: unknown
): Promise<StandardResponse<T>> {
  return api<T>(path, {
    method: "PUT",
    body: data ? JSON.stringify(data) : null,
  });
}

// DELETE 요청 헬퍼
export async function apiDelete<T = unknown>(path: string): Promise<StandardResponse<T>> {
  return api<T>(path, { method: "DELETE" });
}


