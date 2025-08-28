import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { context, trace } from "@opentelemetry/api";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      traceId?: string;
      spanId?: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  // X-Request-ID 헤더가 있으면 사용, 없으면 새로 생성
  req.requestId = (req.headers["x-request-id"] as string) || randomUUID();

  // OpenTelemetry trace 정보 추출
  const activeContext = context.active();
  const span = trace.getSpan(activeContext);

  if (span) {
    const spanContext = span.spanContext();
    req.traceId = spanContext.traceId;
    req.spanId = spanContext.spanId;
  }

  // 응답 헤더에 상관관계 정보 포함
  res.set({
    "X-Request-ID": req.requestId,
    "X-Trace-ID": req.traceId || "unknown",
    "X-Span-ID": req.spanId || "unknown",
  });

  // 로깅 (선택적)
  if (process.env.LOG_REQUEST_ID === "true") {
    console.log(
      `[REQUEST] ${req.method} ${req.path} | RequestID: ${req.requestId} | TraceID: ${req.traceId || "N/A"}`,
    );
  }

  next();
}

// default로도 내보내기
export default requestId;
