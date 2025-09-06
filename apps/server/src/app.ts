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
import { healthRouter } from "./routes/health";

// 🆕 부팅 로그 추가
console.log('[BOOT] app.ts file =', 'src/app.ts');
console.log('[BOOT] apiRouter resolved path =', require.resolve('./routes'));
console.log('[BOOT] healthRouter path =', require.resolve('./routes/health'));
console.log('[BOOT] communityRouter path =', require.resolve('./routes/community'));

// 🆕 Redis 연결 테스트 (앱 부팅 시 1회 핑)
(async () => {
  try {
    const redis = await ensureRedis();
    const pong = await redis.ping();
    console.log("🔌 Redis OK:", pong);
  } catch (e) {
    console.error("❌ Redis connect failed:", e);
    console.error("Redis URL:", process.env.REDIS_URL);
  }
})();

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

// 🆕 디버그 엔드포인트
function listRoutes(appOrRouter: any, base = '') {
  const routes: string[] = [];
  const stack = appOrRouter?.stack || appOrRouter?._router?.stack || [];
  for (const layer of stack) {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      routes.push(`${methods.padEnd(6)} ${base}${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const prefix = layer.regexp?.fast_star
        ? `${base}*`
        : layer.regexp?.fast_slash
          ? `${base}/`
          : (layer.regexp?.toString() || base);
      routes.push(...listRoutes(layer.handle, base));
    }
  }
  return routes;
}

app.get('/__whoami', (_req, res) => {
  res.json({ file: __filename, now: new Date().toISOString() });
});

app.get('/__routes', (_req, res) => {
  try {
    const listRoutes = (layer: any, base = ''): string[] => {
      const out: string[] = [];
      const stack = (layer?.stack) || (layer?._router?.stack) || [];
      for (const l of stack) {
        if (l.route?.path) {
          const methods = Object.keys(l.route.methods||{}).map(m=>m.toUpperCase()).join(',');
          out.push(`${methods.padEnd(6)} ${base}${l.route.path}`);
        } else if (l.name === 'router' || l.handle?._router) {
          out.push(...listRoutes(l.handle?._router || l.handle, base)); // prefix 단순화
        }
      }
      return out;
    };
    const routes = listRoutes((app as any)._router);
    res.json({ 
      count: routes.length, 
      routes: routes,
      apiBase: API_BASE,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ▼ API 라우터 마운트 (가장 중요!)
const API_BASE = process.env.API_BASE || "/api/v1";

// 베이스 핑을 앱 레벨에서 보장 (라우터와 별개로 항상 응답)
app.get(`${API_BASE}/_ping`, (_req, res) => {
  res.type("text/plain").send("pong");
});

// 1) 가장 먼저 정확 경로로 health만 노출 (넓은 패턴 절대 금지)
app.use(`${API_BASE}/health`, healthRouter);

// 2) 그 다음에 실제 API 라우터(커뮤니티 포함)
app.use(API_BASE, apiRouter);

// ▼ 에러 핸들러
app.use(standardErrorHandler);
app.use(errorHandler);

// 3) 404 핸들러는 반드시 맨 끝으로 유지
app.use((_req, res) => res.status(404).json({ success: false, code: 'NOT_FOUND' }));

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
  const logRoutes = () => {
    console.log("\n[dev] Registered routes:");

    // 간단한 방법: apiRouter의 라우트 정보 직접 출력
    console.log("📋 API Router Info:");
    console.log(`- Base path: ${API_BASE}`);
    console.log(`- Router stack length: ${apiRouter.stack.length}`);

    // 각 라우터별 정보 출력
    apiRouter.stack.forEach((layer: any, index: number) => {
      if (layer.name === "router") {
        console.log(`- Router ${index + 1}: ${layer.regexp?.source || "unknown"}`);
        if (layer.handle?.stack) {
          console.log(`  └─ Sub-routes: ${layer.handle.stack.length}`);
        }
      }
    });

    // 실제 등록된 라우트들을 상세히 출력
    console.log("\n📋 Detailed Route List:");
    const routeList: string[] = [];
    
    const extractRoutes = (router: any, basePath: string = "") => {
      if (router.stack) {
        router.stack.forEach((layer: any) => {
          if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(",").toUpperCase();
            const path = `${API_BASE}${basePath}${layer.route.path}`;
            routeList.push(`${methods.padEnd(6)} ${path}`);
          } else if (layer.name === "router") {
            const subPath = layer.regexp?.source?.replace(/\\\//g, "/").replace(/\^|\$|\\/g, "") || "";
            extractRoutes(layer.handle, basePath + subPath);
          }
        });
      }
    };
    
    extractRoutes(apiRouter);
    routeList.forEach(route => console.log(route));

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

// 테스트를 위해 export
export default app;
