import type { Request, Response } from 'express';
import { ok } from '../../utils/apiResponse.js';
import { listUsersSchema, userIdSchema, type AssignRoleInput } from './users.validator.js';
import * as service from './users.service.js';

export async function list(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.listUsers(listUsersSchema.parse(req.query)));
}

export async function assignRole(req: Request, res: Response): Promise<Response> {
  return ok(res, await service.assignRole(userIdSchema.parse(req.params.id), req.body as AssignRoleInput, req.user!));
}
