// 기존 otpStore.ts와 호환되는 데이터베이스 기반 OTP 저장소
// 기존 API 호환성 유지하면서 데이터 영속성 확보

import { Pool } from 'pg';
import { createHash } from 'crypto';

// 기존 otpStore.ts와 동일한 인터페이스 유지
export type OtpRecord = {
  code: string;
  expiresAt: number;
  attempts: number;
  lockedUntil?: number;
  lastSentAt?: number;
};

// 환경변수에서 설정 읽기 (기존과 동일)
const SEC = 1000;
const MIN = 60 * SEC;
const TTL_SEC = Number(process.env.OTP_CODE_TTL_SEC ?? 180);
const RESEND_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SEC ?? 60);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
const LOCK_MIN = Number(process.env.OTP_LOCK_MINUTES ?? 10);

// 데이터베이스 연결
let pool: Pool;

export function initOtpRepo(dbPool: Pool) {
  pool = dbPool;
}

// 기존 otpStore.ts와 동일한 함수들 (데이터베이스 기반으로 구현)
export async function canSend(phone: string): Promise<{ ok: boolean; waitMs: number }> {
  const now = Date.now();
  
  try {
    const result = await pool.query(
      `SELECT last_sent_at FROM auth_sms_codes 
       WHERE phone_e164_norm = $1 AND purpose = 'login' 
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );
    
    if (result.rows.length === 0) {
      return { ok: true, waitMs: 0 };
    }
    
    const lastSentAt = result.rows[0].last_sent_at?.getTime() || 0;
    const waitMs = lastSentAt + RESEND_COOLDOWN_SEC * SEC - now;
    
    return { ok: waitMs <= 0, waitMs: Math.max(0, waitMs) };
  } catch (error) {
    console.error('canSend error:', error);
    return { ok: true, waitMs: 0 }; // 에러 시 기본값 반환
  }
}

export async function putCode(phone: string, code: string, purpose: string = 'login'): Promise<OtpRecord> {
  const now = Date.now();
  const codeHash = createHash('sha256').update(code).digest('hex');
  
  try {
    // 기존 코드 삭제 (같은 전화번호, 같은 목적)
    await pool.query(
      'DELETE FROM auth_sms_codes WHERE phone_e164_norm = $1 AND purpose = $2',
      [phone, purpose]
    );
    
    // 새 코드 저장
    await pool.query(
      `INSERT INTO auth_sms_codes 
       (phone_e164_norm, code_hash, purpose, expire_at, try_count, max_try) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        phone,
        codeHash,
        purpose,
        new Date(now + TTL_SEC * SEC),
        0,
        MAX_ATTEMPTS
      ]
    );
    
    const record: OtpRecord = {
      code,
      expiresAt: now + TTL_SEC * SEC,
      attempts: 0,
      lastSentAt: now,
      lockedUntil: undefined,
    };
    
    return record;
  } catch (error) {
    console.error('putCode error:', error);
    throw new Error('Failed to store OTP code');
  }
}

export async function getRecord(phone: string): Promise<OtpRecord | null> {
  try {
    const result = await pool.query(
      `SELECT code_hash, expire_at, try_count, max_try, created_at 
       FROM auth_sms_codes 
       WHERE phone_e164_norm = $1 AND purpose = 'login' 
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      code: '[HIDDEN]', // 보안상 실제 코드는 반환하지 않음
      expiresAt: row.expire_at.getTime(),
      attempts: row.try_count,
      lastSentAt: row.created_at.getTime(),
      lockedUntil: undefined, // 잠금 기능은 별도 구현 필요
    };
  } catch (error) {
    console.error('getRecord error:', error);
    return null;
  }
}

export async function incAttempt(phone: string): Promise<number> {
  try {
    const result = await pool.query(
      `UPDATE auth_sms_codes 
       SET try_count = try_count + 1 
       WHERE phone_e164_norm = $1 AND purpose = 'login' 
       RETURNING try_count, max_try`,
      [phone]
    );
    
    if (result.rows.length === 0) {
      return 0;
    }
    
    const { try_count, max_try } = result.rows[0];
    
    // 최대 시도 횟수 초과 시 잠금 처리
    if (try_count >= max_try) {
      await pool.query(
        `UPDATE auth_sms_codes 
         SET expire_at = NOW() + INTERVAL '${LOCK_MIN} minutes' 
         WHERE phone_e164_norm = $1 AND purpose = 'login'`,
        [phone]
      );
    }
    
    return try_count;
  } catch (error) {
    console.error('incAttempt error:', error);
    return 0;
  }
}

export async function clear(phone: string): Promise<void> {
  try {
    await pool.query(
      'DELETE FROM auth_sms_codes WHERE phone_e164_norm = $1 AND purpose = $2',
      [phone, 'login']
    );
  } catch (error) {
    console.error('clear error:', error);
  }
}

export async function isLocked(phone: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT expire_at, try_count, max_try 
       FROM auth_sms_codes 
       WHERE phone_e164_norm = $1 AND purpose = 'login' 
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const { expire_at, try_count, max_try } = result.rows[0];
    const now = new Date();
    
    // 시도 횟수 초과로 잠긴 경우
    if (try_count >= max_try && expire_at > now) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('isLocked error:', error);
    return false;
  }
}

export function getConstants() {
  return { TTL_SEC, RESEND_COOLDOWN_SEC, MAX_ATTEMPTS, LOCK_MIN };
}

// 기존 otpStore.ts와 동일한 함수들
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function verifyCode(phone: string, code: string, purpose: string = 'login'): Promise<boolean> {
  try {
    const codeHash = createHash('sha256').update(code).digest('hex');
    
    const result = await pool.query(
      `SELECT id, expire_at, try_count, max_try 
       FROM auth_sms_codes 
       WHERE phone_e164_norm = $1 AND purpose = $2 AND code_hash = $3`,
      [phone, purpose, codeHash]
    );
    
    if (result.rows.length === 0) {
      // 코드가 틀린 경우 시도 횟수 증가
      await incAttempt(phone);
      return false;
    }
    
    const row = result.rows[0];
    const now = new Date();
    
    // 만료 확인
    if (row.expire_at < now) {
      await clear(phone);
      return false;
    }
    
    // 잠금 확인
    if (row.try_count >= row.max_try) {
      return false;
    }
    
    // 검증 성공 시 사용 처리 및 삭제
    await pool.query(
      `UPDATE auth_sms_codes 
       SET used_at = NOW() 
       WHERE id = $1`,
      [row.id]
    );
    
    // 잠시 후 삭제 (보안상)
    setTimeout(() => clear(phone), 5000);
    
    return true;
  } catch (error) {
    console.error('verifyCode error:', error);
    return false;
  }
}
