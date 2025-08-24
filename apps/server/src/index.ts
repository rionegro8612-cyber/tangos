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
import { startTracing, stopTracing, getTracingStatus } from "./lib/tracing"; // 🆕 추가
import metricsMiddleware from "./middlewares/metrics"; // 🆕 Added: 메트릭 미들웨어
import errorHandler from "./middlewares/error";
import apiRouter from "./routes";
import { getMetrics, getMetricsStatus } from "./lib/metrics"; // 🆕 Added: 메트릭 함수들

const app = express();
app.disable("x-powered-by");

// 🆕 OpenTelemetry 트레이싱 시작
startTracing();

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
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1년
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

// HTTPS 강제 리다이렉트 (프로덕션에서만)
if (process.env.NODE_ENV === "production" && process.env.FORCE_HTTPS === "true") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

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
  const defaultDevAllows = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"];
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

// 🆕 메트릭 미들웨어 추가 (requestId 이후, 라우터 이전)
app.use(metricsMiddleware); // 🆕 Added: HTTP 요청 메트릭 수집

// ▼ 헬스체크 (항상 라우터 마운트보다 위에!)
app.get("/health", (_req, res) => res.status(200).type("text/plain").send("OK"));
app.get("/api/v1/_ping", (_req, res) => res.status(200).type("text/plain").send("pong"));

// 🆕 Kubernetes 표준 헬스체크 엔드포인트 추가
app.get("/livez", (_req, res) => res.status(200).type("text/plain").send("OK"));
app.get("/readyz", async (_req, res) => {
  try {
    // 데이터베이스 연결 상태 확인
    const dbClient = new (require('pg').Client)({ connectionString: process.env.DATABASE_URL });
    await dbClient.connect();
    await dbClient.query('SELECT 1');
    await dbClient.end();
    
    // Redis 연결 상태 확인
    const redis = require('redis').createClient({ url: process.env.REDIS_URL });
    await redis.connect();
    await redis.ping();
    await redis.disconnect();
    
    res.status(200).type("text/plain").send("OK");
  } catch (error) {
    console.error('[READYZ] Health check failed:', error);
    res.status(503).type("text/plain").send("Service Unavailable");
  }
});

// 🆕 메트릭 엔드포인트 추가
app.get("/metrics", async (_req, res) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.end(metrics);
  } catch (error) {
    console.error('[METRICS] Failed to collect metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to collect metrics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 🆕 메트릭 상태 확인 엔드포인트
app.get("/api/v1/_metrics", (_req, res) => {
  res.json({
    success: true,
    data: getMetricsStatus(),
    timestamp: new Date().toISOString()
  });
});

// 🆕 트레이싱 상태 확인 엔드포인트
app.get("/api/v1/_tracing", (_req, res) => {
  res.json({
    success: true,
    data: getTracingStatus(),
    timestamp: new Date().toISOString()
  });
});

// 🆕 통합 상태 확인 엔드포인트
app.get("/api/v1/_health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      tracing: getTracingStatus(),
      metrics: getMetricsStatus()
    }
  });
});

// ▼ API 라우터 마운트 (가장 중요!)
const API_BASE = process.env.API_BASE || "/api/v1";
app.use(API_BASE, router);

// ▼ 에러 핸들러
app.use(standardErrorHandler);
app.use(errorHandler);

// 🆕 프로세스 종료 시 트레이싱 정리
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down gracefully...');
  stopTracing();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SERVER] SIGINT received, shutting down gracefully...');
  stopTracing();
  process.exit(0);
});

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
