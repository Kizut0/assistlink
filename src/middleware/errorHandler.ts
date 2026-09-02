import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { fail } from '../utils/apiResponse.js';
import { config } from '../config/index.js';

// Central error handler. Must be registered last, with four arguments.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): Response {
  if (err instanceof ApiError) {
    return fail(res, err.statusCode, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return fail(res, 400, 'Validation failed', err.issues);
  }

  // Upstream client errors (e.g. body-parser sets err.status = 400 on malformed JSON).
  const upstream = (err as { status?: number; statusCode?: number }).status
    ?? (err as { status?: number; statusCode?: number }).statusCode;
  if (typeof upstream === 'number' && upstream >= 400 && upstream < 500) {
    return fail(res, upstream, err instanceof Error ? err.message : 'Bad Request');
  }

  console.error('Unhandled error:', err);
  const message = config.isProduction
    ? 'Internal Server Error'
    : err instanceof Error
      ? err.message
      : String(err);
  return fail(res, 500, message);
}
