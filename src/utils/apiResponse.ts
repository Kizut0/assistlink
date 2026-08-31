import type { Response } from 'express';

// Consistent success envelope: { success: true, data }
export function ok(res: Response, data: unknown, status = 200): Response {
  return res.status(status).json({ success: true, data });
}

// Consistent error envelope: { success: false, error: { message, details? } }
export function fail(res: Response, status: number, message: string, details?: unknown): Response {
  return res
    .status(status)
    .json({ success: false, error: { message, ...(details !== undefined ? { details } : {}) } });
}
