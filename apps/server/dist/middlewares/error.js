"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = errorHandler;
const AppError_1 = require("../errors/AppError");
const errorCodes_1 = require("../lib/errorCodes");
function errorHandler(err, req, res, _next) {
    const requestId = req.requestId || "";
    // StandardError 인스턴스인 경우 (우선순위 1)
    if (err instanceof errorCodes_1.StandardError) {
        return res.status(err.httpStatus).json({
            success: false,
            code: err.code,
            message: err.message,
            data: err.data || null,
            requestId,
        });
    }
    // AppError 인스턴스인 경우 (하위 호환성)
    if (err instanceof AppError_1.AppError) {
        return res.fail(err.code, err.message, err.status, err.data);
    }
    // 에러코드가 매핑에 있는 경우 StandardError로 변환
    if (err?.code && errorCodes_1.ERROR_MAPPINGS[err.code]) {
        const mapping = errorCodes_1.ERROR_MAPPINGS[err.code];
        return res.status(mapping.httpStatus).json({
            success: false,
            code: mapping.code,
            message: err.message || mapping.message,
            data: err.data || null,
            requestId,
        });
    }
    // 기존 에러 처리 (최종 fallback)
    const httpStatus = err?.status || err?.statusCode || 500;
    const errorCode = httpStatus >= 500 ? "INTERNAL_ERROR" : (err?.code || "ERROR");
    const message = err?.message || 'Internal Server Error';
    // 개발환경에서는 상세 에러 로그 출력
    if (process.env.NODE_ENV === 'development') {
        console.error('[ERROR]', {
            code: errorCode,
            message,
            stack: err?.stack,
            requestId,
        });
    }
    res.status(httpStatus).json({
        success: false,
        code: errorCode,
        message,
        data: null,
        requestId,
    });
}
