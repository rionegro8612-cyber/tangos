import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(err);
  res.status(500).json({
    success: false,
    code: 'SERVER_ERROR',
    message: err.message,
    requestId: (req as any).requestId
  });
}
