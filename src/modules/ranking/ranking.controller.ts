import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError.js';
import { ok } from '../../utils/apiResponse.js';
import * as service from './ranking.service.js';

export async function rank(req: Request, res: Response): Promise<Response> {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) throw ApiError.badRequest('Invalid post id');
  return ok(res, await service.rankPost(id, req.user!));
}
