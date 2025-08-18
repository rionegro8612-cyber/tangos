import dotenv from "dotenv";
import path from "path";

// CJS/ESM 모두에서 동작: 현재 작업 디렉터리 기준으로 .env 로드
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath, override: true });

export {};
