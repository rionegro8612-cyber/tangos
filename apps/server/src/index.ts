import "./env";

import express from "express";
import helmet from "helmet";
import cors, { CorsOptionsDelegate } from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { router } from "./apiRouter";
import requestId from "./middlewares/requestId";
import { responseMiddleware, standardErrorHandler } from "./lib/response";
import { setupCleanupScheduler } from "./lib/cleanup";
import { ensureRedis } from "./lib/redis";

const app = express();
app.disable("x-powered-by");

// ▼ 필수 파서 (JSON/FORM/쿠키)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ▼ 보안/로그/CORS
const TRUST_PROXY = process.env.TRUST_PROXY ?? "1";
app.set("trust proxy", TRUST_PROXY === "1" ? 1 : TRUST_PROXY);

// 프로덕션 모드에서 보안 헤더 강화
app.use(helmet({
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  contentSecurityPolicy: false, // 기존 설정 유지
}));

// 로깅 설정 (프로덕션에서는 간소화)
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// CORS 설정 (프로덕션 모드에 맞게)
const corsOrigin = process.env.CORS_ORIGIN;
const frontOrigins = process.env.FRONT_ORIGINS;

let allowList: Set<string>;
if (process.env.NODE_ENV === "production") {
  // 프로덕션: CORS_ORIGIN 우선, 없으면 FRONT_ORIGINS
  const origins = corsOrigin || frontOrigins || "";
  allowList = new Set(origins.split(",").map(s => s.trim()).filter(Boolean));
} else {
  // 개발: 기본 허용 + 환경변수
  const envAllow = (frontOrigins || "").split(",").map(s => s.trim()).filter(Boolean);
  const defaultDevAllows = ["http://localhost:3000", "http://127.0.0.1:3000"];
  allowList = new Set(envAllow.length ? envAllow : defaultDevAllows);
}

const corsDelegate: CorsOptionsDelegate = (req, cb) => {
  const origin = (req.headers.origin as string) || "";
  
  // 프로덕션에서는 origin이 반드시 있어야 함
  if (process.env.NODE_ENV === "production" && !origin) {
    return cb(new Error("CORS: Origin required in production"));
  }
  
  const ok = !origin || allowList.has(origin);
  cb(null, {
    origin: ok,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
};
app.use(cors(corsDelegate));

// ▼ 공통 미들웨어(요청ID, 표준 응답 래퍼)
app.use(requestId);
app.use(responseMiddleware);

// ▼ 헬스체크 (항상 라우터 마운트보다 위에!)
app.get("/health", (_req, res) => res.status(200).type("text/plain").send("OK"));
app.get("/api/v1/_ping", (_req, res) => res.status(200).type("text/plain").send("pong"));
// ▼ API 라우터 마운트 (가장 중요!)
const API_BASE = process.env.API_BASE || "/api/v1";
app.use(API_BASE, router);

// ▼ 에러 핸들러
app.use(standardErrorHandler);

// ▼ 개발 시 등록된 라우트 로그
if (process.env.NODE_ENV !== "production") {
  const logRoutes = () => {
    console.log("\n[dev] Registered routes:");
    
    // 간단한 방법: apiRouter의 라우트 정보 직접 출력
    console.log("📋 API Router Info:");
    console.log(`- Base path: ${API_BASE}`);
    console.log(`- Router stack length: ${router.stack.length}`);
    
    // 각 라우터별 정보 출력
    router.stack.forEach((layer: any, index: number) => {
      if (layer.name === 'router') {
        console.log(`- Router ${index + 1}: ${layer.regexp?.source || 'unknown'}`);
        if (layer.handle?.stack) {
          console.log(`  └─ Sub-routes: ${layer.handle.stack.length}`);
        }
      }
    });
    
    console.log("\n🔍 Manual route check:");
    console.log("GET  /api/v1/_ping");
    console.log("POST /api/v1/auth/send-sms");
    console.log("POST /api/v1/auth/verify-login");
    console.log("GET  /api/v1/auth/me");
    console.log("POST /api/v1/auth/refresh");
    console.log("POST /api/v1/auth/logout");
    console.log("POST /api/v1/auth/register/start");
    console.log("POST /api/v1/auth/register/verify");
    console.log("POST /api/v1/auth/register/complete");
    console.log("GET  /api/v1/profile/nickname/check");
    console.log("POST /api/v1/profile/nickname");
    console.log("POST /api/v1/profile/region");
  };
  setTimeout(logRoutes, 200);
}

const port = Number(process.env.PORT) || 4100;
console.log(`[env] PORT=${process.env.PORT ?? "(undefined)"} → use ${port}`);

(async () => {
  await ensureRedis();
  app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
    console.log("=== SERVER STARTED ===", new Date().toISOString());
    setupCleanupScheduler();
  });
})();
