import type { Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cookieOptions, readCookie } from '../../utils/session.js';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config/index.js';
import { ok } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { getMsal, REDIRECT_URI, SCOPES } from './auth.service.js';

// Task 13 — GET /auth/login: build the AD authorization URL and redirect.
export async function login(req: Request, res: Response): Promise<void> {
  const state = randomBytes(32).toString('hex');
  const url = await getMsal().getAuthCodeUrl({ scopes: SCOPES, redirectUri: REDIRECT_URI, state });
  res.cookie('assistlink_oauth', jwt.sign({ state, web: req.query.web === '1' }, config.jwt.secret, { expiresIn: '10m' }), { ...cookieOptions, maxAge: 600000 });
  res.redirect(url);
}

// Task 13/14 — GET /auth/callback: exchange the code, upsert the user, issue a JWT.
export async function callback(req: Request, res: Response): Promise<Response> {
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  if (!code) throw ApiError.badRequest('Missing authorization code');

  let browserLogin = false;
  try {
    const saved = jwt.verify(readCookie(req, 'assistlink_oauth') ?? '', config.jwt.secret) as jwt.JwtPayload;
    const actual = typeof req.query.state === 'string' ? req.query.state : '';
    if (typeof saved.state !== 'string' || actual.length !== saved.state.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(saved.state))) throw new Error('State mismatch');
    browserLogin = saved.web === true;
  } catch { throw ApiError.unauthorized('Sign-in expired. Please start sign-in again.'); }
  res.clearCookie('assistlink_oauth', cookieOptions);

  const result = await getMsal().acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  });

  const acct = result.account;
  if (!acct) throw ApiError.unauthorized('Microsoft AD did not return an account');

  // Only new AD accounts default to STUDENT. Admin-assigned roles survive later sign-ins.
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

  if (browserLogin) {
    res.cookie('assistlink_session', token, cookieOptions);
    res.redirect('/assistlink/');
    return res;
  }

  return ok(res, {
    token,
    user: { userId: user.id, name: user.name, email: user.email, role: user.role },
  });
}

export async function logout(req: Request, res: Response): Promise<Response> {
  if (req.header('x-assistlink-request') !== 'web') throw ApiError.forbidden('Missing browser request header');
  res.clearCookie('assistlink_session', cookieOptions);
  return ok(res, null);
}

// Task 17 — GET /auth/me: the decoded current user (auth middleware has run).
export async function me(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized();
  return ok(res, req.user);
}
