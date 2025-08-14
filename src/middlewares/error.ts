import type { Request, Response, NextFunction } from 'express';

export default function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const code = err?.status || 500;
  const requestId = (req as any).requestId || null;
  res.status(code).json({
    success: false,
    code,
    message: err?.message || 'Internal Server Error',
    requestId,
  });
}
