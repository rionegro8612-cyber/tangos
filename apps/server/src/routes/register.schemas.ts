import { z } from "zod";

// 약관 동의 스키마
const AgreementSchema = z.object({
  code: z.string(),        // e.g. TOS / PRIVACY / MARKETING
  version: z.string(),     // 문자열 버전 "1.0"
  required: z.boolean(),
  accepted: z.boolean()
});

// 프로필 정보 스키마
const ProfileSchema = z.object({
  nickname: z.string().min(2).max(20),
  region: z.string().min(1),
  birthYear: z.number().int().gte(1900).lte(new Date().getFullYear())
});

// 회원가입 제출 스키마
export const SubmitSchema = z.object({
  profile: ProfileSchema,
  agreements: z.array(AgreementSchema).min(1),
  referralCode: z.string().optional()
});

// 타입 추론
export type SubmitDto = z.infer<typeof SubmitSchema>;
export type ProfileDto = z.infer<typeof ProfileSchema>;
export type AgreementDto = z.infer<typeof AgreementSchema>;
