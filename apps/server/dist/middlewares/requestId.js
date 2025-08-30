"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestId = requestId;
const crypto_1 = require("crypto");
const api_1 = require("@opentelemetry/api");
function requestId(req, res, next) {
    // X-Request-ID 헤더가 있으면 사용, 없으면 새로 생성
    req.requestId = req.headers["x-request-id"] || (0, crypto_1.randomUUID)();
    // OpenTelemetry trace 정보 추출
    const activeContext = api_1.context.active();
    const span = api_1.trace.getSpan(activeContext);
    if (span) {
        const spanContext = span.spanContext();
        req.traceId = spanContext.traceId;
        req.spanId = spanContext.spanId;
    }
    // 응답 헤더에 상관관계 정보 포함
    res.set({
        "X-Request-ID": req.requestId,
        "X-Trace-ID": req.traceId || "unknown",
        "X-Span-ID": req.spanId || "unknown",
    });
    // 로깅 (선택적)
    if (process.env.LOG_REQUEST_ID === "true") {
        console.log(`[REQUEST] ${req.method} ${req.path} | RequestID: ${req.requestId} | TraceID: ${req.traceId || "N/A"}`);
    }
    next();
}
// default로도 내보내기
exports.default = requestId;
