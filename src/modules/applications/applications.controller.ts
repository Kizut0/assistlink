import type { Request, Response } from 'express';
import { ok } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import type { DecideApplicationInput } from './applications.validator.js';
import * as service from './applications.service.js';
import * as resumes from '../profiles/resumes.service.js';

export async function listMine(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listMyApplications(req.user!.userId));
}

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

export async function getApplicantResume(req: Request, res: Response): Promise<Response> {
  const postId = parseId(req.params.postId, 'post');
  const applicationId = parseId(req.params.applicationId, 'application');
  const resume = await resumes.getApplicantResume(postId, applicationId, req.user!);
  const encoded = encodeURIComponent(resume.fileName);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': String(resume.sizeBytes),
    'Content-Disposition': `inline; filename="resume.pdf"; filename*=UTF-8''${encoded}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  return res.send(Buffer.from(resume.pdf));
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
