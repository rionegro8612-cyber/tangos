"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifySchema = exports.PhoneSchema = void 0;
const zod_1 = require("zod");
// E.164 전화번호 검증 스키마
exports.PhoneSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone (E.164)"),
});
// OTP 코드 검증 스키마
exports.VerifySchema = exports.PhoneSchema.extend({
    code: zod_1.z.string().regex(/^\d{6}$/, "Invalid code (6 digits)"),
});
