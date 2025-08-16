import type { Request, Response, NextFunction } from "express";

export type ApiEnvelope<T = unknown> = {
  success: boolean;
  code: string;
  message?: string;
  data?: T | null;
  requestId?: string | null;
};

declare global {
  namespace Express {
    interface Response {
      ok: <T = unknown>(data: T, message?: string, code?: string) => void;
      fail: (code: string, message?: string, status?: number, data?: unknown) => void;
    }
    interface Request {
      requestId?: string;
      userId?: number;
    }
  }
}

export function responseMiddleware(req: Request, res: Response, next: NextFunction) {
  res.ok = <T = unknown>(data: T, message = "OK", code = "OK") => {
    const env: ApiEnvelope<T> = {
      success: true,
      code,
      message,
      data,
      requestId: (req as any)?.requestId ?? null,
    };
    res.status(200).json(env);
  };

  res.fail = (code: string, message = "Error", status = 400, data: unknown = null) => {
    const env: ApiEnvelope = {
      success: false,
      code,
      message,
      data,
      requestId: (req as any)?.requestId ?? null,
    };
    res.status(status).json(env);
  };

  next();
}

export function standardErrorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = typeof err?.status === "number" ? err.status : 500;
  const code =
    err?.code ||
    (status === 400
      ? "BAD_REQUEST"
      : status === 401
      ? "UNAUTHORIZED"
      : status === 404
      ? "NOT_FOUND"
      : "INTERNAL_ERROR");
  const message = err?.message || "Internal Server Error";
  const env: ApiEnvelope = {
    success: false,
    code,
    message,
    data: null,
    requestId: (req as any).requestId ?? null,
  };
  res.status(status).json(env);
}
