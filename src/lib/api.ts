const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function newRequestId() {
  return (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export class ApiError extends Error {
  code: string;
  requestId?: string;
  status?: number;
  raw?: string;
  constructor(message: string, opts: { code: string; requestId?: string; status?: number; raw?: string }) {
    super(message);
    this.code = opts.code;
    this.requestId = opts.requestId;
    this.status = opts.status;
    this.raw = opts.raw;
  }
}

type ApiEnvelope<D = unknown> = {
  success: boolean;
  code?: string;
  message?: string;
  requestId?: string;
  data?: D;
};

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { authToken?: string } = {}
): Promise<T> {
  const requestId = newRequestId();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  if (options.authToken) headers.set("Authorization", `Bearer ${options.authToken}`);
  headers.set("X-Request-Id", requestId);

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { ...options, headers, cache: "no-store" });

  // 204 No Content 처리
  if (res.status === 204) {
    return {} as T;
  }

  // Content-Type 확인 후 파싱
  const ct = res.headers.get("content-type") || "";
  let text = "";
  try {
    text = await res.text();
  } catch {
    throw new ApiError("Invalid JSON response", { code: "INVALID_JSON", requestId, status: res.status });
  }

  let envelopeUnknown: unknown = null;
  if (text) {
    if (ct.includes("application/json")) {
      try {
        envelopeUnknown = JSON.parse(text);
      } catch {
        throw new ApiError("Invalid JSON response", { code: "INVALID_JSON", requestId, status: res.status, raw: text });
      }
    } else {
      // json이 아니면 그대로 raw를 에러에 담아 전달
      throw new ApiError("Non-JSON response", { code: "NON_JSON", requestId, status: res.status, raw: text });
    }
  } else {
    // 바디가 아예 없을 때
    envelopeUnknown = null;
  }

  // 표준 응답 검사
  const isValidEnvelope =
    typeof envelopeUnknown === "object" &&
    envelopeUnknown !== null &&
    "success" in (envelopeUnknown as Record<string, unknown>) &&
    typeof (envelopeUnknown as { success: unknown }).success === "boolean";

  if (!isValidEnvelope) {
    throw new ApiError("Non-standard response", {
      code: "INVALID_SHAPE",
      requestId,
      status: res.status,
      raw: text,
    });
  }

  const envelope = envelopeUnknown as ApiEnvelope<T>;

  if (!res.ok || !envelope.success) {
    throw new ApiError(envelope.message || "Request failed", {
      code: envelope.code || "UNKNOWN_ERROR",
      requestId: envelope.requestId || requestId,
      status: res.status,
      raw: text,
    });
  }

  return (envelope.data ?? {}) as T;
}
