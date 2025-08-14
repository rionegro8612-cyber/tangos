import { Router } from 'express';
import { pool } from '../lib/db.js';

export const dbRouter = Router();

dbRouter.get('/ping', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, code: 'OK', message: 'db ok', data: { now: result.rows[0].now }, requestId: 'dev' });
  } catch (err) {
    res.status(500).json({ success: false, code: 'DB_ERROR', message: err.message, requestId: 'dev' });
  }
});
