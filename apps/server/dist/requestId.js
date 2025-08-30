"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestId = requestId;
function requestId(req, res, next) {
    req.requestId = "dev";
    next();
}
