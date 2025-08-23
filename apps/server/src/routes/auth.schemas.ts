import { z } from "zod";

// E.164 전화번호 검증 스키마
export const PhoneSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone (E.164)")
});

// OTP 코드 검증 스키마
export const VerifySchema = PhoneSchema.extend({
  code: z.string().regex(/^\d{6}$/, "Invalid code (6 digits)")
});

// 타입 추론
export type PhoneDto = z.infer<typeof PhoneSchema>;
export type VerifyDto = z.infer<typeof VerifySchema>;

// 검증 결과 타입
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; errors: string[] };
