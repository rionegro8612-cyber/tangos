import { Pool, QueryResultRow } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// HMR/개발 중 중복 연결 방지
declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

export const pool =
  global.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // 필요 시 활성화 (호스팅 가이드 확인)
    // ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") global.pgPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = []
): Promise<T[]> {
  const values = Array.from(params) as any[];
  const { rows } = await pool.query<T>(text, values);
  return rows;
}
