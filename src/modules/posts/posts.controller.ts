import type { Request, Response } from 'express';
import { ok } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { createPostSchema, updatePostSchema } from './posts.validator.js';
import * as service from './posts.service.js';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest('Invalid post id');
  }
  return id;
}

export async function list(_req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listPosts());
}

export async function getOne(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.getPost(parseId(req.params.id)));
}

export async function create(req: Request, res: Response): Promise<Response> {
  const input = createPostSchema.parse(req.body);
  const post = await service.createPost(req.user!.id, input);
  return ok(res, post, 201);
}

export async function update(req: Request, res: Response): Promise<Response> {
  const input = updatePostSchema.parse(req.body);
  const post = await service.updatePost(parseId(req.params.id), req.user!, input);
  return ok(res, post);
}

export async function close(req: Request, res: Response): Promise<Response> {
  const post = await service.closePost(parseId(req.params.id), req.user!);
  return ok(res, post);
}
