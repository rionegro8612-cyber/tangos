import { generateOTP, validatePhoneNumber, formatPhoneNumber } from './utils.js';
import { canSend, putCode, getRecord, incAttempt, isLocked, clear } from '../../otpStore.js';

export class SMSService {
  async sendOTP(phone: string): Promise<{ success: boolean; message: string; waitMs?: number }> {
    try {
      // 전화번호 형식 검증
      if (!validatePhoneNumber(phone)) {
        return { success: false, message: '올바르지 않은 전화번호 형식입니다.' };
      }

      const formattedPhone = formatPhoneNumber(phone);

      // 잠금 상태 확인
      if (isLocked(formattedPhone)) {
        return { success: false, message: '너무 많은 시도로 인해 일시적으로 잠겼습니다.' };
      }

      // 재전송 대기 시간 확인
      const sendCheck = canSend(formattedPhone);
      if (!sendCheck.ok) {
        return { 
          success: false, 
          message: '잠시 후 다시 시도해주세요.', 
          waitMs: sendCheck.waitMs 
        };
      }

      // OTP 생성 및 저장
      const otp = generateOTP();
      putCode(formattedPhone, otp);

      // TODO: 실제 SMS 발송 로직 구현
      console.log(`SMS sent to ${formattedPhone}: ${otp}`);

      return { success: true, message: '인증번호가 발송되었습니다.' };
    } catch (error) {
      console.error('SMS 발송 오류:', error);
      return { success: false, message: '인증번호 발송에 실패했습니다.' };
    }
  }

  async verifyOTP(phone: string, code: string): Promise<{ success: boolean; message: string }> {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      const record = getRecord(formattedPhone);

      if (!record) {
        return { success: false, message: '인증번호를 먼저 발송해주세요.' };
      }

      if (Date.now() > record.expiresAt) {
        clear(formattedPhone);
        return { success: false, message: '인증번호가 만료되었습니다.' };
      }

      if (record.code === code) {
        clear(formattedPhone);
        return { success: true, message: '인증이 완료되었습니다.' };
      } else {
        const attempts = incAttempt(formattedPhone);
        if (attempts >= 5) {
          return { success: false, message: '너무 많은 시도로 인해 일시적으로 잠겼습니다.' };
        }
        return { success: false, message: `인증번호가 일치하지 않습니다. (${attempts}/5)` };
      }
    } catch (error) {
      console.error('OTP 검증 오류:', error);
      return { success: false, message: '인증번호 검증에 실패했습니다.' };
    }
  }
}



