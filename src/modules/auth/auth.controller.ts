import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config/index.js';
import { ok } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { getMsal, REDIRECT_URI, SCOPES } from './auth.service.js';

// Task 13 — GET /auth/login: build the AD authorization URL and redirect.
export async function login(_req: Request, res: Response): Promise<void> {
  const url = await getMsal().getAuthCodeUrl({ scopes: SCOPES, redirectUri: REDIRECT_URI });
  res.redirect(url);
}

// Task 13/14 — GET /auth/callback: exchange the code, upsert the user, issue a JWT.
export async function callback(req: Request, res: Response): Promise<Response> {
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  if (!code) throw ApiError.badRequest('Missing authorization code');

  const result = await getMsal().acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  });

  const acct = result.account;
  if (!acct) throw ApiError.unauthorized('Microsoft AD did not return an account');

  // New AD users default to STUDENT; promotion to PROFESSOR/ADMIN is admin-only (Task 39b).
  const user = await prisma.user.upsert({
    where: { adObjectId: acct.homeAccountId },
    update: { name: acct.name ?? acct.username, email: acct.username },
    create: {
      adObjectId: acct.homeAccountId,
      name: acct.name ?? acct.username,
      email: acct.username,
      role: 'STUDENT',
    },
  });

  const signOptions: SignOptions = { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] };
  const token = jwt.sign({ userId: user.id, role: user.role }, config.jwt.secret, signOptions);

  return ok(res, {
    token,
    user: { userId: user.id, name: user.name, email: user.email, role: user.role },
  });
}

// Task 17 — GET /auth/me: the decoded current user (auth middleware has run).
export async function me(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, req.user);
}
