import { Router } from 'express';
import { authRouter } from './routes/auth.js';

const router = Router();

// 인증 라우트
router.use('/auth', authRouter);

// 헬스체크
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    requestId: req.requestId 
  });
});

export { router };
