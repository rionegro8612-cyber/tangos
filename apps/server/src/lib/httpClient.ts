// apps/server/src/lib/httpClient.ts
/**
 * 외부 연동을 위한 HTTP 클라이언트 (타임아웃, 리트라이, 표준화)
 */

import { StandardError, createError } from "./errorCodes";

export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface RequestConfig extends HttpClientConfig {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  signal?: AbortSignal;
}

export interface StandardResponse<T = any> {
  success: boolean;
  data: T | null;
  code?: string;
  message?: string;
  requestId?: string;
}

/**
 * 외부 API 응답을 StandardResponse로 변환
 */
function wrapExternalResponse<T>(response: any, serviceName: string): StandardResponse<T> {
  // 이미 StandardResponse 형태인 경우
  if (response && typeof response === "object" && "success" in response) {
    return response as StandardResponse<T>;
  }

  // 외부 API 응답을 표준 형태로 래핑
  return {
    success: true,
    data: response,
    message: `${serviceName} API response`,
  };
}

/**
 * 재시도 가능한 에러인지 확인
 */
function isRetryableError(error: any): boolean {
  // 네트워크 에러
  if (error.code === "ECONNRESET" || error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
    return true;
  }

  // HTTP 상태코드 기반 판단
  const status = error.status || error.response?.status;
  if (status) {
    // 5xx 서버 에러는 재시도
    if (status >= 500) return true;
    // 429 Rate Limit도 재시도
    if (status === 429) return true;
    // 408 Request Timeout도 재시도
    if (status === 408) return true;
  }

  return false;
}

/**
 * 지연 함수
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTTP 클라이언트 클래스
 */
export class HttpClient {
  private config: HttpClientConfig;

  constructor(config: HttpClientConfig = {}) {
    this.config = {
      timeout: 3000, // 기본 3초
      retries: 2,
      retryDelay: 1000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TangoApp/1.0",
      },
      ...config,
    };
  }

  /**
   * HTTP 요청 수행 (리트라이 포함)
   */
  async request<T>(url: string, config: RequestConfig = {}): Promise<StandardResponse<T>> {
    const mergedConfig = { ...this.config, ...config };
    const { retries = 2, retryDelay = 1000 } = mergedConfig;

    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.performRequest<T>(url, mergedConfig);
        return response;
      } catch (error) {
        lastError = error;

        // 마지막 시도거나 재시도 불가능한 에러면 throw
        if (attempt === retries || !isRetryableError(error)) {
          break;
        }

        // 재시도 전 지연
        await delay(retryDelay * (attempt + 1)); // 지수 백오프
      }
    }

    // 모든 재시도 실패
    throw lastError;
  }

  /**
   * 실제 HTTP 요청 수행
   */
  private async performRequest<T>(
    url: string,
    config: RequestConfig,
  ): Promise<StandardResponse<T>> {
    const { method = "GET", body, timeout = 3000, headers = {}, signal } = config;

    // AbortController로 타임아웃 처리
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // 사용자가 제공한 signal과 타임아웃 signal 조합
    if (signal) {
      signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const fetchConfig: RequestInit = {
        method,
        headers: {
          ...this.config.headers,
          ...headers,
        },
        signal: controller.signal,
      };

      if (body && method !== "GET") {
        fetchConfig.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchConfig);
      clearTimeout(timeoutId);

      // HTTP 에러 상태 처리
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        throw createError.externalApiError(this.getServiceNameFromUrl(url), {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
        });
      }

      // 응답 파싱
      const responseText = await response.text();
      let responseData;
      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseData = responseText;
      }

      return wrapExternalResponse<T>(responseData, this.getServiceNameFromUrl(url));
    } catch (error) {
      clearTimeout(timeoutId);

      // AbortError (타임아웃)
      if (error instanceof Error && error.name === "AbortError") {
        throw new StandardError("KYC_API_TIMEOUT", `Request timeout (${timeout}ms): ${url}`);
      }

      // StandardError는 그대로 전파
      if (error instanceof StandardError) {
        throw error;
      }

      // 기타 네트워크 에러
      throw createError.externalApiError(this.getServiceNameFromUrl(url), {
        message: error instanceof Error ? error.message : "Unknown network error",
        code: (error as any)?.code,
      });
    }
  }

  /**
   * URL에서 서비스명 추출
   */
  private getServiceNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return "External API";
    }
  }

  /**
   * GET 요청
   */
  async get<T>(
    url: string,
    config?: Omit<RequestConfig, "method" | "body">,
  ): Promise<StandardResponse<T>> {
    return this.request<T>(url, { ...config, method: "GET" });
  }

  /**
   * POST 요청
   */
  async post<T>(
    url: string,
    body?: any,
    config?: Omit<RequestConfig, "method" | "body">,
  ): Promise<StandardResponse<T>> {
    return this.request<T>(url, { ...config, method: "POST", body });
  }

  /**
   * PUT 요청
   */
  async put<T>(
    url: string,
    body?: any,
    config?: Omit<RequestConfig, "method" | "body">,
  ): Promise<StandardResponse<T>> {
    return this.request<T>(url, { ...config, method: "PUT", body });
  }

  /**
   * DELETE 요청
   */
  async delete<T>(
    url: string,
    config?: Omit<RequestConfig, "method" | "body">,
  ): Promise<StandardResponse<T>> {
    return this.request<T>(url, { ...config, method: "DELETE" });
  }
}

/**
 * 미리 구성된 HTTP 클라이언트 인스턴스들
 */

// 기본 클라이언트 (3초 타임아웃)
export const httpClient = new HttpClient();

// 지도 API용 클라이언트 (5초 타임아웃)
export const mapClient = new HttpClient({
  timeout: 5000,
  retries: 1,
});

// KYC API용 클라이언트 (10초 타임아웃, 재시도 없음)
export const kycClient = new HttpClient({
  timeout: 10000,
  retries: 0,
});

// SMS API용 클라이언트 (5초 타임아웃)
export const smsClient = new HttpClient({
  timeout: 5000,
  retries: 1,
});
