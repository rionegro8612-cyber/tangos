// apps/server/src/index.ts
import "./env"; // ← 반드시 최상단

import express from "express";
import helmet from "helmet";
import cors, { CorsOptionsDelegate } from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { router } from "./apiRouter";
import requestId from "./middlewares/requestId";
import { responseMiddleware, standardErrorHandler } from "./lib/response";

const app = express();

// ─────────────────────────────────────────────────────────────
// 기본 보안/운영 설정
// ─────────────────────────────────────────────────────────────
app.disable("x-powered-by");

// 프록시 환경에서 req.ip / x-forwarded-* 처리 정확도를 위해 환경변수로 제어
// TRUST_PROXY 예) "1"(기본), "loopback", "true", "0"
const TRUST_PROXY = process.env.TRUST_PROXY ?? "1";
app.set("trust proxy", /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);

// ✅ 헬스체크 (미들웨어 영향 0)
app.get("/health", (_req, res) => res.status(200).type("text/plain").send("OK"));
app.get("/api/v1/_ping", (_req, res) => res.status(200).type("text/plain").send("pong"));

// ─────────────────────────────────────────────────────────────
// CORS: FRONT_ORIGINS(콤마 분리) 없으면 로컬 기본 허용
// 별도 app.options("*") 등록 없이, 프리플라이트까지 cors 미들웨어가 처리
// ─────────────────────────────────────────────────────────────
const envAllow = (process.env.FRONT_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const defaultDevAllows = ["http://localhost:3000", "http://127.0.0.1:3000"];
const allowList = new Set(envAllow.length ? envAllow : defaultDevAllows);

const corsDelegate: CorsOptionsDelegate = (req, cb) => {
  const origin = (req.headers.origin as string) || "";
  const ok = !origin || allowList.has(origin);
  cb(null, {
    origin: ok,
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 600,
  });
};

app.use(cors(corsDelegate));

// 보안 헤더
app.use(helmet());

// Body parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Cookies
app.use(cookieParser());

// 로깅 (헬스/파비콘 스킵)
app.use(
  morgan("dev", {
    skip: (req) => req.path === "/health" || req.path === "/favicon.ico",
  })
);

// 공통 미들웨어
app.use(requestId);
app.use(responseMiddleware);

// API 엔트리
const API_BASE = "/api/v1";
app.use(API_BASE, router);

/* ============================================================
 * ✅ 임시 라우트 (라우팅 체인 확인용)
 *    정상 동작 확인 후 이 블록은 삭제하세요.
 * ============================================================ */
app.get(`${API_BASE}/auth/kyc/ping`, (_req, res) => {
  res.json({
    success: true,
    code: "OK",
    message: "reached /auth/kyc/ping via index.ts direct",
  });
});

app.post(`${API_BASE}/auth/kyc/pass`, (_req, res) => {
  res.json({
    success: true,
    code: "OK",
    message: "reached /auth/kyc/pass via index.ts direct",
  });
});
/* ============================================================ */

// 직접 라우트 등록 테스트
app.get("/api/v1/auth/kyc/ping", (_req, res) => {
  res.json({ success: true, message: "kyc pong (direct)" });
});
app.post("/api/v1/auth/kyc/pass", (_req, res) => {
  res.json({ success: true, message: "kyc pass (direct)" });
});

// 표준 에러 핸들러 (맨 마지막)
app.use(standardErrorHandler);

// ─────────────────────────────────────────────────────────────
// 개발 편의: 등록된 라우트 테이블 로깅 (dev에서만)
// ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  const logRoutes = () => {
    type Row = { method: string; path: string };
    const rows: Row[] = [];

    const regexpToPath = (re?: RegExp): string => {
      if (!re) return "";
      // /^\/api\/v1\/?(?=\/|$)/ → /api/v1 로 정리
      const src = re.source
        .replace("\\/?(?=\\/|$)", "")
        .replace("^\\/", "/")
        .replace(/\\\//g, "/")
        .replace(/[\^\$]/g, "");
      return src;
    };

    const walk = (stack: any[], prefix = "") => {
      stack.forEach((layer: any) => {
        if (layer.route?.path) {
          const methods = Object.keys(layer.route.methods).map((v) => v.toUpperCase());
          const p = prefix + (layer.route.path === "/" ? "" : layer.route.path);
          methods.forEach((m) => rows.push({ method: m, path: p || "/" }));
        } else if (layer.name === "router" && layer.handle?.stack) {
          const mount = regexpToPath(layer.regexp);
          walk(layer.handle.stack, prefix + mount);
        }
      });
    };

    const rootStack: any[] = (app as any)?._router?.stack || [];
    walk(rootStack, "");

    const filtered = rows
      .filter((r) => r.path.startsWith(API_BASE))
      .sort((a, b) => (a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)));

    console.log("\n[dev] Registered routes:");
    console.table(filtered);
  };
  setTimeout(logRoutes, 120);
}

// ✅ 직접 라우트 등록 테스트 (listen 이전에 위치해야 함)
app.get("/api/v1/auth/kyc/ping", (_req, res) => {
  console.log("=== /api/v1/auth/kyc/ping HIT ===");
  res.json({ success: true, message: "kyc pong (direct)" });
});
app.post("/api/v1/auth/kyc/pass", (_req, res) => {
  res.json({ success: true, message: "kyc pass (direct)" });
});

// 포트
const rawPort = process.env.PORT;
const port = Number(rawPort) || 4100;
console.log(`[env] PORT=${rawPort ?? "(undefined)"} → use ${port}`);

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
  console.log("=== SERVER STARTED ===", new Date().toISOString());
});
