import { Router } from 'express';
import { SMSService } from '../auth/sms/service.js';

const router = Router();
const smsService = new SMSService();

// SMS 인증번호 발송
router.post('/send-sms', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: '전화번호가 필요합니다.' });
    }

    const result = await smsService.sendOTP(phone);
    
    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(400).json({ 
        error: result.message,
        waitMs: result.waitMs 
      });
    }
  } catch (error) {
    console.error('SMS 발송 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// SMS 인증번호 검증
router.post('/verify-code', async (req, res) => {
  try {
    const { phone, code } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({ error: '전화번호와 인증번호가 필요합니다.' });
    }

    const result = await smsService.verifyOTP(phone, code);
    
    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('코드 검증 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export { router as authRouter };



