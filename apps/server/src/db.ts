import { Pool, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = []
): Promise<T[]> {
  const values = Array.from(params) as any[];
  const { rows } = await pool.query<T>(text, values);
  return rows;
}
