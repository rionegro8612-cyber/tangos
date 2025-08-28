import { Router } from "express";
import { pool } from "../lib/db";
const router = Router();

router.get("/ping", async (_req, res) => {
  const { rows } = await pool.query("SELECT 1 as ok");
  res.json({ ok: rows[0].ok === 1 });
});

export default router;
