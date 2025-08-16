// src/lib/db.ts
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// 여러 위치 후보에서 .env 탐색 (ts-node/dev & dist 모두 대응)
const candidates = [
  path.resolve(process.cwd(), '.env'),         // 현재 작업 디렉토리
  path.resolve(__dirname, '../../.env'),       // dist/lib -> ../../.env or src/lib -> ../../.env
  path.resolve(__dirname, '../.env'),          // 혹시 src 바로 아래에 있는 경우
];

let loadedFrom = '';
for (const p of candidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    loadedFrom = p;
    break;
  }
}
if (!loadedFrom) {
  // 마지막 시도: 기본(.env) 로드
  dotenv.config();
}

// 필수 env 검사
function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`[DB] Missing required env: ${name}`);
  return v;
}

const host = required('DB_HOST');
const port = Number(required('DB_PORT'));
const user = required('DB_USER');
const password = String(required('DB_PASSWORD'));
const database = required('DB_NAME');

export const pool = new Pool({
  host,
  port,
  user,
  password,
  database,
  ssl: process.env.DB_SSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});
