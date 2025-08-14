// src/routes.ts  (폴더 구조가 routes/라면 index.ts에 동일 내용)
import { Router } from 'express';
import authRouter from './routes/auth'; // 하위 라우터가 src/routes/auth.ts일 때

const router = Router();

// 핑 테스트
router.get('/ping', (_req, res) => {
  res.json({ pong: true });
});

// 인증 라우트 장착 (router.use!)
router.use('/auth', authRouter);

export default router; // ✅ default export
