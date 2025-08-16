// src/index.ts
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { router } from "./routes";
import requestId from "./middlewares/requestId"; // ✅ default import
import { responseMiddleware, standardErrorHandler } from "./lib/response";

const app = express();

// CORS: FRONT_ORIGINS=.env에서 읽어 동적 허용
const allow = (process.env.FRONT_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // same-origin
      if (allow.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"), false);
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use(requestId);
app.use(responseMiddleware);

app.use("/api/v1", router);
app.get("/health", (_req, res) => res.ok({ ok: true }, "HEALTH_OK"));

app.use(standardErrorHandler);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
