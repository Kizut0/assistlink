import type { Request, Response } from 'express';
import { ok } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import type { DecideApplicationInput } from './applications.validator.js';
import * as service from './applications.service.js';

function parseId(raw: string | string[] | undefined, label: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest(`Invalid ${label} id`);
  }
  return id;
}

// Task 23 — POST /posts/:postId/applications
export async function apply(req: Request, res: Response): Promise<Response> {
  const postId = parseId(req.params.postId, 'post');
  const application = await service.applyToPost(req.user!.userId, postId);
  return ok(res, application, 201);
}

// Task 24 — GET /posts/:postId/applications
export async function listApplicants(req: Request, res: Response): Promise<Response> {
  const postId = parseId(req.params.postId, 'post');
  return ok(res, await service.listApplicants(postId, req.user!));
}

// Task 25 — PATCH /applications/:id  (body already validated by validate())
export async function decide(req: Request, res: Response): Promise<Response> {
  const applicationId = parseId(req.params.id, 'application');
  const updated = await service.decideApplication(
    applicationId,
    req.user!,
    req.body as DecideApplicationInput,
  );
  return ok(res, updated);
}
