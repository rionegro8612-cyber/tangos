// src/routes/mvp.ts
import { Router } from 'express';
import db from './db';
import auth from './auth.mvp';
import kyc from './kyc.mvp';
import user from './user';      // ✅ 꼭 필요

const router = Router();

// 경로 프리픽스와 순서 유의!
router.use('/db', db);          // /api/v1/db/ping
router.use(auth);               // /api/v1/auth/...
router.use('/auth', kyc);                // /api/v1/auth/kyc/pass
router.use(user);               // ✅ /api/v1/me

export default router;
