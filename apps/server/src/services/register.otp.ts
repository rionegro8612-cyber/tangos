import * as otp from "../otpStore";
import sms from "../vendors/sms";

const DEFAULT_TTL = Number(process.env.OTP_CODE_TTL_SEC ?? 300);

export async function issueOtp(phone: string, purpose: string) {
  const code = otp.generateCode();
  otp.putCode(phone, code);
  // send via SMS vendor (mock in dev by default)
  if (process.env.NODE_ENV !== "test") {
    await sms.send(phone, `[Tango] 인증번호: ${code}`);
  }
  return { ttlSec: DEFAULT_TTL, devCode: code };
}

export async function verifyOtp(phone: string, code: string, purpose: string) {
  return otp.verifyCode(phone, code);
}
