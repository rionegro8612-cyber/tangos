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

// ▼ 필수 파서 (JSON/FORM/쿠키)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ▼ 보안/로그/CORS
const TRUST_PROXY = process.env.TRUST_PROXY ?? "1";
app.set("trust proxy", TRUST_PROXY === "1" ? 1 : TRUST_PROXY);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("dev"));

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
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
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
      stack.forEach((layer) => {
        if (layer?.route) {
          const p = prefix + layer.route.path;
          rows.push({ method: Object.keys(layer.route.methods)[0]?.toUpperCase(), path: p });
        } else if (layer?.name === "router" && layer?.handle?.stack) {
          const pfx = prefix + regexpToPath(layer.regexp);
          walk(layer.handle.stack, pfx);
        }
      });
    };
    // @ts-ignore
    walk(app._router?.stack || []);
    const filtered = rows
      .filter((r) => r.path.startsWith(API_BASE))
      .sort((a, b) => (a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)));
    console.log("\n[dev] Registered routes:");
    console.table(filtered);
  };
  setTimeout(logRoutes, 200);
}

const port = Number(process.env.PORT) || 4100;
console.log(`[env] PORT=${process.env.PORT ?? "(undefined)"} → use ${port}`);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
  console.log("=== SERVER STARTED ===", new Date().toISOString());
});
