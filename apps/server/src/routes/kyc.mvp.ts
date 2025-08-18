import { Router } from 'express';
import { pool } from '../lib/db';
import { verifyPASS } from '../lib/vendors/passClient';
import { verifyNICE } from '../lib/vendors/niceClient';

const router = Router();

// YYYYMMDD → 만 나이 계산
function calcAge(birthYmd: string): number | null {
  if (!/^\d{8}$/.test(birthYmd)) return null;
  const y = Number(birthYmd.slice(0, 4));
  const m = Number(birthYmd.slice(4, 6)) - 1;
  const d = Number(birthYmd.slice(6, 8));
  const dob = new Date(Date.UTC(y, m, d));
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  if (month < m || (month === m && day < d)) age--;
  return age;
}

router.post('/kyc/pass', async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '');
    const birth = String(body.birth || '');
    const phone = String(body.phone || '');
    const carrier = String(body.carrier || '');

    if (!name || !birth || !phone || !carrier) {
      return res.status(400).json({ success: false, code: 'INVALID_ARG', message: 'name, birth, phone, carrier required' });
    }

    const age = calcAge(birth);
    if (age === null) {
      return res.status(400).json({ success: false, code: 'INVALID_BIRTH', message: 'birth must be YYYYMMDD' });
    }

    const minAge = Number(process.env.KYC_MIN_AGE || 50);
    let verified = false;
    let providerTraceId = '';

    // 1차 PASS, 실패 시 NICE 폴백
    try {
      const r1: any = await verifyPASS({ name, birth, phone, carrier });
      verified = !!r1?.verified;
      providerTraceId = String(r1?.providerTraceId || '');
    } catch {
      const r2: any = await verifyNICE({ name, birth, phone, carrier });
      verified = !!r2?.verified;
      providerTraceId = String(r2?.providerTraceId || '');
    }

    if (!verified) {
      return res.status(403).json({ success: false, code: 'KYC_FAILED', message: 'kyc failed' });
    }

    if (age < minAge) {
      return res.status(403).json({ success: false, code: 'KYC_AGE_RESTRICTED', message: `가입은 만 ${minAge}세 이상부터 가능합니다.` });
    }

    const q = await pool.query(
      'UPDATE users SET is_kyc_verified=TRUE, kyc_verified_at=NOW() WHERE phone_e164_norm=$1',
      [phone]
    );

    if (q.rowCount === 0) {
      return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'user not found for phone' });
    }

    return res.status(200).json({ success: true, code: 'OK', message: 'kyc verified', data: { providerTraceId } });
  } catch (err: any) {
    return res.status(502).json({ success: false, code: 'KYC_PROVIDER_ERROR', message: String(err?.message || 'KYC error') });
  }
});

export default router;
