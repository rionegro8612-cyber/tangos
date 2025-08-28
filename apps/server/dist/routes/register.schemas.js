"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmitSchema = void 0;
const zod_1 = require("zod");
// 약관 동의 스키마
const AgreementSchema = zod_1.z.object({
    code: zod_1.z.string(), // e.g. TOS / PRIVACY / MARKETING
    version: zod_1.z.string(), // 문자열 버전 "1.0"
    required: zod_1.z.boolean(),
    accepted: zod_1.z.boolean()
});
// 프로필 정보 스키마
const ProfileSchema = zod_1.z.object({
    nickname: zod_1.z.string().min(2).max(20),
    region: zod_1.z.string().min(1),
    birthYear: zod_1.z.number().int().gte(1900).lte(new Date().getFullYear())
});
// 회원가입 제출 스키마
exports.SubmitSchema = zod_1.z.object({
    profile: ProfileSchema,
    agreements: zod_1.z.array(AgreementSchema).min(1),
    referralCode: zod_1.z.string().optional()
});
