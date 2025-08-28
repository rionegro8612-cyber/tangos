"use strict";
// apps/server/src/lib/otpService.ts
/**
 * OTP 서비스 - 정책 강화 버전
 * TTL 5분, 1분 3회/1일 5회 제한, 해시 저장
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.sendOtp = sendOtp;
exports.resendOtp = resendOtp;
exports.verifyOtp = verifyOtp;
const crypto_1 = require("crypto");
const db_1 = require("./db");
const errorCodes_1 = require("./errorCodes");
/**
 * OTP 코드 생성 (6자리)
 */
function generateOtpCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
/**
 * OTP 코드 해시 생성
 */
function hashOtpCode(code, salt) {
    return (0, crypto_1.createHash)('sha256').update(code + salt).digest('hex');
}
/**
 * 전화번호 E.164 정규화
 */
function normalizePhoneNumber(phone) {
    // 한국 번호 정규화 (+82로 시작)
    let normalized = phone.replace(/\s+/g, '').replace(/-/g, '');
    if (normalized.startsWith('0')) {
        normalized = '+82' + normalized.substring(1);
    }
    else if (normalized.startsWith('82')) {
        normalized = '+' + normalized;
    }
    else if (!normalized.startsWith('+82')) {
        normalized = '+82' + normalized;
    }
    return normalized;
}
/**
 * OTP 전송 제한 체크
 */
async function checkOtpLimits(phone) {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    try {
        // 1분 내 3회 제한 체크
        const oneMinQuery = `
      SELECT COUNT(*) as count 
      FROM auth_sms_codes 
      WHERE phone_e164_norm = $1 AND created_at > $2
    `;
        const oneMinResult = await db_1.pool.query(oneMinQuery, [phone, oneMinuteAgo]);
        const oneMinCount = parseInt(oneMinResult.rows[0].count);
        if (oneMinCount >= 3) {
            return {
                canSend: false,
                retryAfter: 60,
                message: '1분 내 3회 제한에 도달했습니다'
            };
        }
        // 1일 내 5회 제한 체크
        const oneDayQuery = `
      SELECT COUNT(*) as count 
      FROM auth_sms_codes 
      WHERE phone_e164_norm = $1 AND created_at > $2
    `;
        const oneDayResult = await db_1.pool.query(oneDayQuery, [phone, oneDayAgo]);
        const oneDayCount = parseInt(oneDayResult.rows[0].count);
        if (oneDayCount >= 5) {
            return {
                canSend: false,
                retryAfter: 24 * 60 * 60,
                message: '1일 내 5회 제한에 도달했습니다'
            };
        }
        return { canSend: true };
    }
    catch (error) {
        console.error('[OTP] Limit check failed:', error);
        // 에러 시에도 전송 허용 (안전성)
        return { canSend: true };
    }
}
/**
 * OTP 전송
 */
async function sendOtp(phone) {
    const normalizedPhone = normalizePhoneNumber(phone);
    try {
        // 제한 체크
        const limitCheck = await checkOtpLimits(normalizedPhone);
        if (!limitCheck.canSend) {
            return {
                success: false,
                ttl: 0,
                retryAfter: limitCheck.retryAfter,
                message: limitCheck.message
            };
        }
        // OTP 코드 생성
        const code = generateOtpCode();
        const salt = (0, crypto_1.randomBytes)(16).toString('hex');
        const codeHash = hashOtpCode(code, salt);
        const expireAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 TTL
        // DB에 저장
        const insertQuery = `
      INSERT INTO auth_sms_codes 
      (phone_e164_norm, code_hash, expire_at, attempt_count)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
        await db_1.pool.query(insertQuery, [
            normalizedPhone,
            codeHash,
            expireAt,
            0
        ]);
        // 개발환경에서는 콘솔에 출력
        if (process.env.NODE_ENV === 'development') {
            console.log(`[DEV] SMS to ${normalizedPhone}: [Tango] 인증번호: ${code}`);
        }
        // 실제 SMS 전송 (환경변수로 제어)
        if (process.env.SMS_ENABLED === 'true') {
            // TODO: 실제 SMS API 연동
            console.log(`[SMS] Sending OTP ${code} to ${normalizedPhone}`);
        }
        return {
            success: true,
            ttl: 300, // 5분
            cooldown: 60 // 1분 후 재전송 가능
        };
    }
    catch (error) {
        console.error('[OTP] Send failed:', error);
        throw errorCodes_1.createError.internalError('OTP 전송 실패', error);
    }
}
/**
 * OTP 재전송
 */
async function resendOtp(phone) {
    const normalizedPhone = normalizePhoneNumber(phone);
    try {
        // 제한 체크 (재전송은 더 엄격하게)
        const limitCheck = await checkOtpLimits(normalizedPhone);
        if (!limitCheck.canSend) {
            return {
                success: false,
                ttl: 0,
                retryAfter: limitCheck.retryAfter,
                message: limitCheck.message
            };
        }
        // 기존 미사용 코드가 있는지 확인
        const existingQuery = `
      SELECT id, created_at 
      FROM auth_sms_codes 
      WHERE phone_e164_norm = $1 
        AND used_at IS NULL 
        AND expire_at > NOW()
      ORDER BY created_at DESC 
      LIMIT 1
    `;
        const existingResult = await db_1.pool.query(existingQuery, [normalizedPhone]);
        if (existingResult.rows.length > 0) {
            const lastSent = new Date(existingResult.rows[0].created_at);
            const timeSinceLastSent = Date.now() - lastSent.getTime();
            // 1분 내 재전송 방지
            if (timeSinceLastSent < 60 * 1000) {
                return {
                    success: false,
                    ttl: 0,
                    retryAfter: Math.ceil((60 * 1000 - timeSinceLastSent) / 1000),
                    message: '1분 후에 재전송할 수 있습니다'
                };
            }
        }
        // 새 OTP 전송
        return await sendOtp(phone);
    }
    catch (error) {
        console.error('[OTP] Resend failed:', error);
        throw errorCodes_1.createError.internalError('OTP 재전송 실패', error);
    }
}
/**
 * OTP 검증
 */
async function verifyOtp(phone, code) {
    const normalizedPhone = normalizePhoneNumber(phone);
    try {
        // 만료되지 않은 미사용 코드 찾기
        const findQuery = `
      SELECT id, code_hash, attempt_count, expire_at
      FROM auth_sms_codes 
      WHERE phone_e164_norm = $1 
        AND used_at IS NULL 
        AND expire_at > NOW()
      ORDER BY created_at DESC 
      LIMIT 1
    `;
        const findResult = await db_1.pool.query(findQuery, [normalizedPhone]);
        if (findResult.rows.length === 0) {
            return {
                success: false,
                message: '유효한 OTP 코드가 없습니다'
            };
        }
        const otpRecord = findResult.rows[0];
        // 시도 횟수 체크 (5회 제한)
        if (otpRecord.attempt_count >= 5) {
            return {
                success: false,
                message: '시도 횟수 초과로 코드가 차단되었습니다'
            };
        }
        // 만료 체크
        if (new Date(otpRecord.expire_at) <= new Date()) {
            return {
                success: false,
                message: 'OTP 코드가 만료되었습니다'
            };
        }
        // 코드 검증 (해시 비교)
        // 실제 구현에서는 salt도 저장해야 함
        const codeHash = hashOtpCode(code, 'default_salt'); // TODO: salt 저장 필요
        if (codeHash !== otpRecord.code_hash) {
            // 시도 횟수 증가
            await db_1.pool.query('UPDATE auth_sms_codes SET attempt_count = attempt_count + 1 WHERE id = $1', [otpRecord.id]);
            return {
                success: false,
                message: 'OTP 코드가 올바르지 않습니다'
            };
        }
        // 성공 시 사용 처리
        await db_1.pool.query('UPDATE auth_sms_codes SET used_at = NOW() WHERE id = $1', [otpRecord.id]);
        return {
            success: true,
            message: 'OTP 인증이 완료되었습니다'
        };
    }
    catch (error) {
        console.error('[OTP] Verification failed:', error);
        throw errorCodes_1.createError.internalError('OTP 검증 실패', error);
    }
}
