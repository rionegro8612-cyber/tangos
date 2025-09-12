import "./env";

import express from "express";
import helmet from "helmet";
import cors, { CorsOptionsDelegate } from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import requestId from "./middlewares/requestId";
import { responseMiddleware, standardErrorHandler } from "./lib/response";
import { setupCleanupScheduler } from "./lib/cleanup";
import { ensureRedis } from "./lib/redis";
import { startTracing, stopTracing, getTracingStatus } from "./lib/tracing";
import metricsMiddleware from "./middlewares/metrics";
import { getMetrics, getMetricsStatus } from "./lib/metrics";
import errorHandler from "./middlewares/error";
import apiRouter from "./routes";

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
app.use(
  helmet({
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
  }),
);

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
  allowList = new Set(
    origins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
} else {
  // 개발: 기본 허용 + 환경변수
  const envAllow = (frontOrigins || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const defaultDevAllows = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ];
  allowList = new Set([...defaultDevAllows, ...envAllow]);
}

const corsDelegate: CorsOptionsDelegate = (req, callback) => {
  const origin = req.headers.origin;
  if (!origin || allowList.has(origin)) {
    callback(null, { origin: true, credentials: true });
  } else {
    callback(null, { origin: false, credentials: false });
  }
};

const corsMiddleware = cors(corsDelegate);
app.use(corsMiddleware);

// ▼ 미들웨어 체인
app.use(requestId);
app.use(responseMiddleware);
app.use(metricsMiddleware);

// 🆕 트레이싱 상태 확인 엔드포인트
app.get("/api/v1/_tracing", (_req, res) => {
  res.json({
    success: true,
    data: getTracingStatus(),
    timestamp: new Date().toISOString(),
  });
});

// 🆕 메트릭스 엔드포인트
app.get("/metrics", async (_req, res) => {
  try {
    const metrics = await getMetrics();
    res.set("Content-Type", "text/plain");
    res.send(metrics);
  } catch (error) {
    console.error("[METRICS] Failed to get metrics:", error);
    res.status(500).json({
      success: false,
      code: "METRICS_ERROR",
      message: "Failed to get metrics",
      data: null,
    });
  }
});

// 🆕 통합 상태 확인 엔드포인트
app.get("/api/v1/_health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      tracing: getTracingStatus(),
      metrics: getMetricsStatus(),
    },
  });
});

// ▼ API 라우터 마운트 (가장 중요!)
const API_BASE = process.env.API_BASE || "/api/v1";
app.use(API_BASE, apiRouter);

// ▼ 에러 핸들러
app.use(standardErrorHandler);
app.use(errorHandler);

// 🆕 프로세스 종료 시 트레이싱 정리
process.on("SIGTERM", () => {
  console.log("[SERVER] SIGTERM received, shutting down gracefully...");
  stopTracing();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[SERVER] SIGINT received, shutting down gracefully...");
  stopTracing();
  process.exit(0);
});

// ▼ 개발 시 등록된 라우트 로그 (테스트 환경에서는 비활성화)
if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  const printRoutes = (app: any) => {
    const walk = (stack: any, prefix = "") => {
      stack.forEach((layer: any) => {
        if (layer.route && layer.route.path) {
          const methods = Object.keys(layer.route.methods)
            .filter((m) => layer.route.methods[m])
            .map((m) => m.toUpperCase())
            .join(",");
          console.log(`${methods.padEnd(7)} ${prefix}${layer.route.path}`);
        } else if (layer.name === "router" && layer.handle?.stack) {
          const path = layer.regexp?.fast_star ? "" :
            (layer.regexp?.fast_slash ? "" : (layer.regexp?.toString() || ""));
          // 경로 추출은 단순화 (prefix 기반으로만)
          walk(layer.handle.stack, prefix);
        }
      });
    };
    console.log("\n[dev] Mounted routes (method path):");
    // API_BASE와 apiRouter 조합으로 실제 mount 지점 출력
    console.log(`(base) ${API_BASE}`);
    // @ts-ignore
    if (app._router?.stack) walk(app._router.stack);
  };
  setTimeout(() => printRoutes(app), 300);
}

// 테스트를 위해 export
export default app;
