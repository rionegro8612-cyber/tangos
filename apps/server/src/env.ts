// apps/server/src/env.ts
import path from "path";
import dotenv from "dotenv";

// 1) 서버 로컬 .env 우선
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

// 2) 루트 .env도 보조로 로드(이미 있으면 덮지 않음)
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });

// 3) DATABASE_URL이 비면 DB_*로 조립(최후의 보루)
if (!process.env.DATABASE_URL) {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
  if (DB_HOST && DB_PORT && DB_NAME && DB_USER) {
    process.env.DATABASE_URL =
      `postgres://${DB_USER}:${DB_PASSWORD || ""}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  }
}
