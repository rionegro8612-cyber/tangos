import { Pool } from 'pg';

let pool: Pool | null = null;

async function getPool(): Promise<Pool> {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export async function seedUser(phone: string) {
  try {
    const db = await getPool();
    await db.query(
      `INSERT INTO users (phone, created_at) VALUES ($1, NOW())
       ON CONFLICT (phone) DO NOTHING`,
      [phone]
    );
    console.log(`[TEST] User seeded: ${phone}`);
  } catch (error) {
    console.error(`[TEST] Failed to seed user: ${phone}`, error);
  }
}

export async function cleanupUsers() {
  try {
    const db = await getPool();
    await db.query('DELETE FROM users WHERE phone LIKE \'+8210000000%\'');
    console.log('[TEST] Test users cleaned up');
  } catch (error) {
    console.error('[TEST] Failed to cleanup users', error);
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

























