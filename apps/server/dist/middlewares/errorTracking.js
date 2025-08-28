"use strict";
// apps/server/src/middlewares/errorTracking.ts
/**
 * 에러율 추적 미들웨어
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorTrackingMiddleware = errorTrackingMiddleware;
const health_1 = require("../lib/health");
/**
 * 응답 후 에러율 추적
 */
function errorTrackingMiddleware(req, res, next) {
    const originalSend = res.send;
    const originalJson = res.json;
    // 응답 가로채기
    res.send = function (body) {
        trackResponse(req, res);
        return originalSend.call(this, body);
    };
    res.json = function (body) {
        trackResponse(req, res);
        return originalJson.call(this, body);
    };
    next();
}
/**
 * 응답 추적
 */
function trackResponse(req, res) {
    const endpoint = getEndpointKey(req);
    const isError = res.statusCode >= 400;
    health_1.errorTracker.addRequest(endpoint, isError);
    // 에러인 경우 추가 로깅
    if (isError && process.env.NODE_ENV === 'development') {
        console.log(`[ERROR_TRACKING] ${endpoint}: ${res.statusCode}`);
    }
}
/**
 * 엔드포인트 키 생성
 */
function getEndpointKey(req) {
    const method = req.method;
    const path = req.route?.path || req.path;
    // 패턴화된 경로로 변환 (ID 등 동적 부분 제거)
    const normalizedPath = path
        .replace(/\/\d+/g, '/:id')
        .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
        .replace(/\/[a-f0-9]{24}/g, '/:objectId');
    return `${method} ${normalizedPath}`;
}
