import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';

// Catch-all for unmatched routes -> 404 via the error handler.
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}
