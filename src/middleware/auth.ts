import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/index.js';
import { readCookie } from '../utils/session.js';
import { prisma } from '../lib/prisma.js';

// Handbook Task 10: three roles only.
export type Role = 'PROFESSOR' | 'ADMIN' | 'STUDENT';

// Handbook Task 14/16: the JWT carries { userId, role }; ownership compares userId.
export interface AuthUser {
  userId: number;
  role: Role;
  email?: string;
  name?: string;
  devImpersonation?: boolean;
}

// Make req.user available and typed across the app.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Task 15 — verify the Bearer JWT on every protected route and attach req.user.
// In NON-production only, an `x-dev-user` header (JSON) may impersonate a user for
// testing; this bypass can NEVER fire when NODE_ENV=production.
export async function auth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const devUser = req.header('x-dev-user');
  if (!config.isProduction && devUser) {
    try {
      const parsed = JSON.parse(devUser) as AuthUser;
      if (!Number.isSafeInteger(parsed.userId) || parsed.userId <= 0 || !['STUDENT', 'PROFESSOR', 'ADMIN'].includes(parsed.role)) {
        return next(ApiError.badRequest('Invalid development user ID or role'));
      }
      req.user = { userId: parsed.userId, role: parsed.role, email: parsed.email, devImpersonation: true };
      return next();
    } catch {
      return next(ApiError.badRequest('Invalid x-dev-user header (must be JSON)'));
    }
  }

  const header = req.header('authorization') ?? '';
  const bearer = /^Bearer\s+([^\s]+)$/i.exec(header)?.[1];
  if (header && !bearer) return next(ApiError.unauthorized('Invalid Authorization header'));
  const token = bearer ?? readCookie(req, 'assistlink_session');
  if (!token) return next(ApiError.unauthorized('No token'));
  // Browser writes must opt in with a same-origin-only custom header. Cross-origin
  // requests cannot set this without a CORS preflight, which this app does not allow.
  if (!bearer && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.header('x-assistlink-request') !== 'web') {
    return next(ApiError.forbidden('Missing browser request header'));
  }

  let userId: number;
  try {
    const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string') return next(ApiError.unauthorized('Invalid token'));
    const payload = decoded as JwtPayload;
    userId = Number(payload.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) return next(ApiError.unauthorized('Invalid token'));
  } catch {
    return next(ApiError.unauthorized('Invalid token'));
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }, select: { id: true, name: true, email: true, role: true },
    });
    if (!user) return next(ApiError.unauthorized('Account no longer exists'));
    req.user = { userId: user.id, name: user.name, email: user.email, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
}
