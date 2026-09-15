import type { Request, Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookieOptions, readCookie } from '../../utils/session.js';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config/index.js';
import { ok } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { getMsal, REDIRECT_URI, SCOPES } from './auth.service.js';
import type { DemoLoginInput } from './auth.validator.js';
import { DEMO_ADMIN, DEMO_PROFESSORS, DEMO_STUDENTS } from '../profiles/demo-data.js';

const DEMO_USERS = new Map<string, string>(
  [...DEMO_STUDENTS, ...DEMO_PROFESSORS, DEMO_ADMIN]
    .map(user => [user.email.toLowerCase(), user.adObjectId]),
);
const DEMO_FAILURE_LIMIT = 5;
const DEMO_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const demoFailures = new Map<string, { count: number; resetAt: number }>();

function secureEqual(left: string, right: string): boolean {
  return timingSafeEqual(createHash('sha256').update(left).digest(), createHash('sha256').update(right).digest());
}

function demoClientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function assertDemoRateLimit(key: string): void {
  const attempt = demoFailures.get(key);
  if (!attempt) return;
  if (attempt.resetAt <= Date.now()) {
    demoFailures.delete(key);
    return;
  }
  if (attempt.count >= DEMO_FAILURE_LIMIT) throw new ApiError(429, 'Too many sign-in attempts. Try again later.');
}

function recordDemoFailure(key: string): void {
  const now = Date.now();
  if (demoFailures.size >= 1_000) {
    for (const [client, attempt] of demoFailures) {
      if (attempt.resetAt <= now) demoFailures.delete(client);
    }
    while (demoFailures.size >= 1_000) demoFailures.delete(demoFailures.keys().next().value!);
  }
  const current = demoFailures.get(key);
  if (!current || current.resetAt <= now) {
    demoFailures.set(key, { count: 1, resetAt: now + DEMO_FAILURE_WINDOW_MS });
  } else {
    current.count += 1;
  }
}

function issueSession(res: Response, user: { id: number; name: string; email: string; role: string }): string {
  const signOptions: SignOptions = { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] };
  const token = jwt.sign({ userId: user.id, role: user.role }, config.jwt.secret, signOptions);
  res.cookie('assistlink_session', token, cookieOptions);
  return token;
}

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

export async function demoLogin(req: Request, res: Response): Promise<Response> {
  if (!config.demoAuth.enabled) throw ApiError.notFound('Not Found');
  if (req.header('x-assistlink-request') !== 'web') throw ApiError.forbidden('Missing browser request header');

  const key = demoClientKey(req);
  assertDemoRateLimit(key);
  const input = req.body as DemoLoginInput;
  const email = input.email.trim().toLowerCase();
  const expectedObjectId = DEMO_USERS.get(email);
  const passcodeValid = secureEqual(input.passcode, config.demoAuth.passcode ?? '');
  const user = expectedObjectId && passcodeValid
    ? await prisma.user.findUnique({
      where: { email },
      select: { id: true, adObjectId: true, name: true, email: true, role: true },
    })
    : null;

  if (!user || user.adObjectId !== expectedObjectId) {
    recordDemoFailure(key);
    throw ApiError.unauthorized('Invalid email or passcode');
  }

  demoFailures.delete(key);
  issueSession(res, user);
  return ok(res, { user: { userId: user.id, name: user.name, email: user.email, role: user.role } });
}

export function __resetDemoLoginRateLimitForTests(): void {
  demoFailures.clear();
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
