import { sendSms as apiSendSms, verifyCode as apiVerifyCode } from "@/lib/api";

export type SendSmsDto = { phone: string }; // 서버에서 E.164 정규화 권장
export type VerifyCodeDto = { phone: string; code: string };

export async function sendSms(dto: SendSmsDto) {
  return apiSendSms(dto.phone);
}

export async function verifyCode(dto: VerifyCodeDto) {
  return apiVerifyCode(dto.phone, dto.code);
}