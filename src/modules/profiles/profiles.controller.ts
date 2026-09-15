import type { Request, Response } from 'express';
import { ok } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import type { UpsertProfileInput } from './profiles.validator.js';
import * as service from './profiles.service.js';
import * as resumes from './resumes.service.js';

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

function sendResume(res: Response, resume: resumes.StoredResume): Response {
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

export async function uploadResume(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, await resumes.uploadMyResume(req.user.userId, req.file), 201);
}

export async function getResume(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized();
  return sendResume(res, await resumes.getMyResume(req.user.userId));
}

export async function deleteResume(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, await resumes.deleteMyResume(req.user.userId));
}
