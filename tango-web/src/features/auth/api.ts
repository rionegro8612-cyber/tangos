import { apiFetch } from "@/lib/api";

export type SendSmsDto = { phone: string }; // 서버에서 E.164 정규화 권장
export type VerifyCodeDto = { phone: string; code: string };

export async function sendSms(dto: SendSmsDto) {
  return apiFetch<{ expiresInSec: number }>("/api/v1/auth/send-sms", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export async function verifyCode(dto: VerifyCodeDto) {
  return apiFetch<{ success: boolean; message?: string }>(
    "/api/v1/auth/verify-code",
    { method: "POST", body: JSON.stringify(dto) }
  );
}