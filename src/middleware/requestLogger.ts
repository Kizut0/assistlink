import type { Request, Response, NextFunction } from 'express';

// Minimal structured request logger. Replaceable with pino/morgan later.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const path = req.originalUrl.split('?')[0];
  res.on('finish', () => {
    const ms = Date.now() - start;
    // OAuth callbacks carry short-lived codes in the query string. Never log it.
    console.log(`${req.method} ${path} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
}
