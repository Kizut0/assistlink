import type { Request, Response } from 'express';
import { ok } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import type { UpsertProfileInput } from './profiles.validator.js';
import * as service from './profiles.service.js';

export async function getMe(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized();
  const profile = await service.getMyProfile(req.user.userId);
  return ok(res, profile);
}

export async function upsertMe(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized();
  const profile = await service.upsertMyProfile(req.user.userId, req.body as UpsertProfileInput);
  return ok(res, profile);
}
