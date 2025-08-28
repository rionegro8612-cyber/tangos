"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseMiddleware = responseMiddleware;
exports.standardErrorHandler = standardErrorHandler;
/** res.ok / res.fail 을 this 바인딩 없이, req/res 클로저로 안전하게 주입 */
function responseMiddleware(req, res, next) {
    res.ok = function (data, message = "OK", code = "OK") {
        res.status(200).json({
            success: true,
            code,
            message,
            data,
            requestId: req.requestId ?? "",
        });
    };
    res.fail = function (code, message, status = 400, data = null) {
        res.status(status).json({
            success: false,
            code,
            message,
            data,
            requestId: req.requestId ?? "",
        });
    };
    next();
}
/** 일관 에러 핸들러 */
function standardErrorHandler(err, req, res, _next) {
    const status = Number(err?.status || 500);
    const code = status >= 500 ? "INTERNAL_ERROR" : (err?.code || "ERROR");
    const message = err?.message || "server error";
    res.status(status).json({
        success: false,
        code,
        message,
        data: null,
        requestId: req.requestId ?? "",
    });
}
