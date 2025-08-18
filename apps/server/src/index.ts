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

// ─────────────────────────────────────────────────────────────
// 기본 보안/운영 설정
// ─────────────────────────────────────────────────────────────
app.disable("x-powered-by");               // Express 노출 제거
app.set("trust proxy", 1);                 // LB/프록시 뒤에서 IP/쿠키 처리 정확히(필요 없으면 0)

// ✅ 헬스체크를 "가장 먼저" 심플 텍스트로(미들웨어 영향 0)
app.get("/health", (_req, res) => {
  res.status(200).type("text/plain").send("OK");
});

// /api/v1/_ping 라우트 추가
app.get("/api/v1/_ping", (_req, res) => {
  res.status(200).type("text/plain").send("pong");
});

// CORS: FRONT_ORIGINS=.env에서 읽어 동적 허용 (콤마 분리)
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

// Helmet: 기본 보안 헤더
app.use(helmet());

// Body parsers: JSON / URL-Encoded with sane limits
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use(cookieParser());

// morgan: 헬스체크/정적/파비콘 스킵
app.use(morgan("dev", {
  skip: (req) => req.path === "/health" || req.path === "/favicon.ico"
}));

// 공통 미들웨어
app.use(requestId);
app.use(responseMiddleware);

// API 엔트리 포인트(prefix: /api/v1)
app.use("/api/v1", router);

// 표준 에러 핸들러 (맨 마지막)
app.use(standardErrorHandler);

// ─────────────────────────────────────────────────────────────
// 개발 편의: 등록된 라우트 테이블 로깅 (dev에서만)
// ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  // 간단한 라우트 인덱서(경로 매핑 확인용)
  const logRoutes = () => {
    const stack: any[] = (app as any)?._router?.stack || [];
    const rows: { method: string; path: string }[] = [];
    const walk = (layers: any[], prefix = "") => {
      layers.forEach(layer => {
        if (layer.route?.path) {
          const methods = Object.keys(layer.route.methods).map(v => v.toUpperCase());
          methods.forEach(m => rows.push({ method: m, path: prefix + layer.route.path }));
        } else if (layer.name === "router" && layer.handle?.stack) {
          // 하위 라우터 재귀 순회
          walk(layer.handle.stack, prefix);
        }
      });
    };
    walk(stack);
    // 보기 쉽게 메서드/경로만
    console.log("\n[dev] Registered routes:");
    console.table(rows);
  };
  // 서버 시작 직후 1회 로깅
  setTimeout(logRoutes, 100);
}

// 🔎 포트 결정(기본값 4100) + 로깅
const rawPort = process.env.PORT;
const port = Number(rawPort) || 4100;
console.log(`[env] PORT=${rawPort ?? "(undefined)"} → use ${port}`);

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
