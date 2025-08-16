import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Response {
      ok<T = unknown>(data: T, message?: string, code?: string): void;
      fail(code: string, message: string, status?: number, data?: any): void;
    }
  }
}

/** res.ok / res.fail 을 this 바인딩 없이, req/res 클로저로 안전하게 주입 */
export function responseMiddleware(req: Request, res: Response, next: NextFunction) {
  res.ok = function <T>(data: T, message = "OK", code = "OK") {
    res.status(200).json({
      success: true,
      code,
      message,
      data,
      requestId: (req as any).requestId ?? null,
    });
  };

  res.fail = function (code: string, message: string, status = 400, data: any = null) {
    res.status(status).json({
      success: false,
      code,
      message,
      data,
      requestId: (req as any).requestId ?? null,
    });
  };

  next();
}

/** 일관 에러 핸들러 */
export function standardErrorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = Number(err?.status || 500);
  const code = status >= 500 ? "INTERNAL_ERROR" : (err?.code || "ERROR");
  const message = err?.message || "server error";

  res.status(status).json({
    success: false,
    code,
    message,
    data: null,
    requestId: (req as any).requestId ?? null,
  });
}
