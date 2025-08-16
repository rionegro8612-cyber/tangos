// apps/server/src/index.ts
import "./env"; // ← 반드시 최상단

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { router } from "./routes";
import requestId from "./middlewares/requestId";
import { responseMiddleware, standardErrorHandler } from "./lib/response";

const app = express();

// ✅ 헬스체크를 "가장 먼저" 심플 텍스트로(미들웨어 영향 0)
app.get("/health", (_req, res) => {
  res.status(200).type("text/plain").send("OK");
});

// CORS: FRONT_ORIGINS=.env에서 읽어 동적 허용
const allow = (process.env.FRONT_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);         // same-origin, curl 등
    if (allow.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked"), false);
  },
  credentials: true,
}));

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use(requestId);
app.use(responseMiddleware);

app.use("/api/v1", router);

// 표준 에러 핸들러 (맨 마지막)
app.use(standardErrorHandler);

// 🔎 포트 결정(기본값 4100) + 로깅
const rawPort = process.env.PORT;
const port = Number(rawPort) || 4100;
console.log(`[env] PORT=${rawPort ?? "(undefined)"} → use ${port}`);

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
