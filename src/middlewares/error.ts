import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(`[${req.requestId}] Error:`, err);
  
  res.status(500).json({
    error: 'Internal Server Error',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
}
