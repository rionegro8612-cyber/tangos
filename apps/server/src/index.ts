import "./env";

import express from "express";
import helmet from "helmet";
import cors, { CorsOptionsDelegate } from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { router } from "./apiRouter";
import requestId from "./middlewares/requestId";
import { responseMiddleware, standardErrorHandler } from "./lib/response";

const app = express();

app.disable("x-powered-by");

const TRUST_PROXY = process.env.TRUST_PROXY ?? "1";
app.set("trust proxy", /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);

// ✅ 건강 체크(미들웨어 영향 X)
app.get("/health", (_req, res) => res.status(200).type("text/plain").send("OK"));
app.get("/api/v1/_ping", (_req, res) => res.status(200).type("text/plain").send("pong"));

// ✅ CORS
const envAllow = (process.env.FRONT_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
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
    methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization","X-Requested-With","Accept"],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 600,
  });
};
app.use(cors(corsDelegate));

// 보안/파서/쿠키/로그
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("dev", { skip: (req) => req.path === "/health" || req.path === "/favicon.ico" }));

// 공통 미들웨어
app.use(requestId);
app.use(responseMiddleware);

// ✅ API 엔트리 (apiRouter 쪽에서 /auth 에 kycRouter 부착)
const API_BASE = "/api/v1";
app.use(API_BASE, router);

// 표준 에러 핸들러
app.use(standardErrorHandler);

// 개발: 라우트 테이블 로깅
if (process.env.NODE_ENV !== "production") {
  const logRoutes = () => {
    type Row = { method: string; path: string };
    const rows: Row[] = [];
    const regexpToPath = (re?: RegExp): string => {
      if (!re) return "";
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

const port = Number(process.env.PORT) || 4100;
console.log(`[env] PORT=${process.env.PORT ?? "(undefined)"} → use ${port}`);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
  console.log("=== SERVER STARTED ===", new Date().toISOString());
});
