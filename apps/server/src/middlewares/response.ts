import type { Request, Response, NextFunction } from "express";

// 중복 타입 선언 제거 (declare global ...)

export function responseMiddleware(req: Request, res: Response, next: NextFunction) {
  (res as any).ok = function (data: any = null, code = "OK", message: string | null = null) {
    return res.status(200).json({
      success: true,
      code,
      message,
      data,
      requestId: (req as any).requestId ?? null,
    });
  };

  (res as any).fail = function (status: number, code: string, message: string | null = null, data: any = null) {
    return res.status(status).json({
      success: false,
      code,
      message,
      data,
      requestId: (req as any).requestId ?? null,
    });
  };

  next();
}
