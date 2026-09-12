import type { Request, Response } from 'express';
import { ok } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import type { CreatePostInput, UpdatePostInput } from './posts.validator.js';
import * as service from './posts.service.js';

function parseId(raw: string | string[] | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest('Invalid post id');
  }
  return id;
}

export async function list(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listPosts(req.query.mine === '1' ? req.user!.userId : undefined));
}

export async function workspace(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.getWorkspace(req.user!.userId));
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.getPost(parseId(req.params.id)));
}

// Body already validated by the shared validate() middleware (Task 21).
export async function create(req: Request, res: Response): Promise<Response> {
  const post = await service.createPost(req.user!.userId, req.body as CreatePostInput);
  return ok(res, post, 201);
}

export async function update(req: Request, res: Response): Promise<Response> {
  const post = await service.updatePost(
    parseId(req.params.id),
    req.user!,
    req.body as UpdatePostInput,
  );
  return ok(res, post);
}

export async function close(req: Request, res: Response): Promise<Response> {
  const post = await service.closePost(parseId(req.params.id), req.user!);
  return ok(res, post);
}
