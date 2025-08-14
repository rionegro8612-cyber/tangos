import { query } from '../../db.js';

export interface SMSRecord {
  id: string;
  phone: string;
  code: string;
  created_at: Date;
  expires_at: Date;
  verified: boolean;
  attempts: number;
}

export class SMSRepository {
  async createSMSRecord(phone: string, code: string, expiresAt: Date): Promise<string> {
    const result = await query<SMSRecord>(
      `INSERT INTO auth_sms_codes (phone, code, expires_at, verified, attempts) 
       VALUES ($1, $2, $3, false, 0) 
       RETURNING id`,
      [phone, code, expiresAt]
    );
    return result[0]?.id || '';
  }

  async getSMSRecord(phone: string): Promise<SMSRecord | null> {
    const result = await query<SMSRecord>(
      `SELECT * FROM auth_sms_codes 
       WHERE phone = $1 AND verified = false 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [phone]
    );
    return result[0] || null;
  }

  async markVerified(id: string): Promise<void> {
    await query(
      `UPDATE auth_sms_codes 
       SET verified = true 
       WHERE id = $1`,
      [id]
    );
  }

  async incrementAttempts(id: string): Promise<void> {
    await query(
      `UPDATE auth_sms_codes 
       SET attempts = attempts + 1 
       WHERE id = $1`,
      [id]
    );
  }

  async deleteExpiredRecords(): Promise<void> {
    await query(
      `DELETE FROM auth_sms_codes 
       WHERE expires_at < NOW()`
    );
  }

  async getAttemptsCount(phone: string, hours: number = 1): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM auth_sms_codes 
       WHERE phone = $1 
       AND created_at > NOW() - INTERVAL '${hours} hours'`,
      [phone]
    );
    return parseInt(result[0]?.count || '0');
  }
}



