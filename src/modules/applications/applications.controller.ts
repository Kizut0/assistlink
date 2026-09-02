import type { Request, Response } from 'express';
import { ok } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import * as service from './applications.service.js';

function parsePostId(raw: string | string[] | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest('Invalid post id');
  }
  return id;
}

export async function apply(req: Request, res: Response): Promise<Response> {
  const postId = parsePostId(req.params.postId);
  const application = await service.applyToPost(req.user!.userId, postId);
  return ok(res, application, 201);
}
