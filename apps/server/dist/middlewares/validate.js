"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const AppError_1 = require("../errors/AppError");
const validate = (schema) => (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        const errors = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
        return next(new AppError_1.AppError(AppError_1.ErrorCodes.VALIDATION_ERROR, 400, "Validation failed", { errors }));
    }
    // 검증된 데이터로 req.body 교체
    Object.assign(req, { body: parsed.data });
    next();
};
exports.validate = validate;
