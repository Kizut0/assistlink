import type { Request, Response } from 'express';
import { ok } from '../../utils/apiResponse.js';

export function getHealth(_req: Request, res: Response): Response {
  return ok(res, { status: 'ok', time: new Date().toISOString() });
}
