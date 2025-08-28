"use strict";
// apps/server/src/lib/httpClient.ts
/**
 * 외부 연동을 위한 HTTP 클라이언트 (타임아웃, 리트라이, 표준화)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsClient = exports.kycClient = exports.mapClient = exports.httpClient = exports.HttpClient = void 0;
const errorCodes_1 = require("./errorCodes");
/**
 * 외부 API 응답을 StandardResponse로 변환
 */
function wrapExternalResponse(response, serviceName) {
    // 이미 StandardResponse 형태인 경우
    if (response && typeof response === 'object' && 'success' in response) {
        return response;
    }
    // 외부 API 응답을 표준 형태로 래핑
    return {
        success: true,
        data: response,
        message: `${serviceName} API response`
    };
}
/**
 * 재시도 가능한 에러인지 확인
 */
function isRetryableError(error) {
    // 네트워크 에러
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return true;
    }
    // HTTP 상태코드 기반 판단
    const status = error.status || error.response?.status;
    if (status) {
        // 5xx 서버 에러는 재시도
        if (status >= 500)
            return true;
        // 429 Rate Limit도 재시도
        if (status === 429)
            return true;
        // 408 Request Timeout도 재시도
        if (status === 408)
            return true;
    }
    return false;
}
/**
 * 지연 함수
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * HTTP 클라이언트 클래스
 */
class HttpClient {
    constructor(config = {}) {
        this.config = {
            timeout: 3000, // 기본 3초
            retries: 2,
            retryDelay: 1000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TangoApp/1.0',
            },
            ...config
        };
    }
    /**
     * HTTP 요청 수행 (리트라이 포함)
     */
    async request(url, config = {}) {
        const mergedConfig = { ...this.config, ...config };
        const { retries = 2, retryDelay = 1000 } = mergedConfig;
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await this.performRequest(url, mergedConfig);
                return response;
            }
            catch (error) {
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
    async performRequest(url, config) {
        const { method = 'GET', body, timeout = 3000, headers = {}, signal } = config;
        // AbortController로 타임아웃 처리
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        // 사용자가 제공한 signal과 타임아웃 signal 조합
        if (signal) {
            signal.addEventListener('abort', () => controller.abort());
        }
        try {
            const fetchConfig = {
                method,
                headers: {
                    ...this.config.headers,
                    ...headers
                },
                signal: controller.signal
            };
            if (body && method !== 'GET') {
                fetchConfig.body = typeof body === 'string' ? body : JSON.stringify(body);
            }
            const response = await fetch(url, fetchConfig);
            clearTimeout(timeoutId);
            // HTTP 에러 상태 처리
            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                }
                catch {
                    errorData = { message: errorText };
                }
                throw errorCodes_1.createError.externalApiError(this.getServiceNameFromUrl(url), {
                    status: response.status,
                    statusText: response.statusText,
                    data: errorData
                });
            }
            // 응답 파싱
            const responseText = await response.text();
            let responseData;
            try {
                responseData = responseText ? JSON.parse(responseText) : null;
            }
            catch {
                responseData = responseText;
            }
            return wrapExternalResponse(responseData, this.getServiceNameFromUrl(url));
        }
        catch (error) {
            clearTimeout(timeoutId);
            // AbortError (타임아웃)
            if (error instanceof Error && error.name === 'AbortError') {
                throw new errorCodes_1.StandardError('KYC_API_TIMEOUT', `Request timeout (${timeout}ms): ${url}`);
            }
            // StandardError는 그대로 전파
            if (error instanceof errorCodes_1.StandardError) {
                throw error;
            }
            // 기타 네트워크 에러
            throw errorCodes_1.createError.externalApiError(this.getServiceNameFromUrl(url), {
                message: error instanceof Error ? error.message : 'Unknown network error',
                code: error?.code
            });
        }
    }
    /**
     * URL에서 서비스명 추출
     */
    getServiceNameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        }
        catch {
            return 'External API';
        }
    }
    /**
     * GET 요청
     */
    async get(url, config) {
        return this.request(url, { ...config, method: 'GET' });
    }
    /**
     * POST 요청
     */
    async post(url, body, config) {
        return this.request(url, { ...config, method: 'POST', body });
    }
    /**
     * PUT 요청
     */
    async put(url, body, config) {
        return this.request(url, { ...config, method: 'PUT', body });
    }
    /**
     * DELETE 요청
     */
    async delete(url, config) {
        return this.request(url, { ...config, method: 'DELETE' });
    }
}
exports.HttpClient = HttpClient;
/**
 * 미리 구성된 HTTP 클라이언트 인스턴스들
 */
// 기본 클라이언트 (3초 타임아웃)
exports.httpClient = new HttpClient();
// 지도 API용 클라이언트 (5초 타임아웃)
exports.mapClient = new HttpClient({
    timeout: 5000,
    retries: 1
});
// KYC API용 클라이언트 (10초 타임아웃, 재시도 없음)
exports.kycClient = new HttpClient({
    timeout: 10000,
    retries: 0
});
// SMS API용 클라이언트 (5초 타임아웃)
exports.smsClient = new HttpClient({
    timeout: 5000,
    retries: 1
});
