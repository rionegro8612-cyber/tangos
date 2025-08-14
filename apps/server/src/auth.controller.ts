import { Router } from 'express';
import { verifyPhoneCode } from './auth.service.js';

export const authRouter = Router();

authRouter.post('/phone/verify', async (req, res) => {
  const { phone, code } = req.body;
  try {
    const result = await verifyPhoneCode(phone, code);
    res.json({ success: true, code: 'OK', message: 'verified', data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, code: 'VERIFY_FAILED', message: err.message });
  }
});
