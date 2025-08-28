"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseMiddleware = responseMiddleware;
// 중복 타입 선언 제거 (declare global ...)
function responseMiddleware(req, res, next) {
    res.ok = function (data = null, code = "OK", message = null) {
        return res.status(200).json({
            success: true,
            code,
            message,
            data,
            requestId: req.requestId ?? null,
        });
    };
    res.fail = function (status, code, message = null, data = null) {
        return res.status(status).json({
            success: false,
            code,
            message,
            data,
            requestId: req.requestId ?? null,
        });
    };
    next();
}
