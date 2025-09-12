// src/routes/health.ts
import { Router } from 'express';
import { getRedis } from '../lib/redis';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ success: true, code: 'OK', message: 'healthy' });
});

healthRouter.get('/ready', async (_req, res) => {
  try {
    const r = getRedis();
    // @ts-ignore
    if (!r?.isOpen) return res.status(503).json({ success: false, code: 'REDIS_DOWN' });
    await r.ping();
    res.json({ success: true, code: 'READY' });
  } catch {
    res.status(503).json({ success: false, code: 'REDIS_DOWN' });
  }
});
