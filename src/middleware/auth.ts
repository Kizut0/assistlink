import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/index.js';

// Handbook Task 10: three roles only.
export type Role = 'PROFESSOR' | 'ADMIN' | 'STUDENT';

// Handbook Task 14/16: the JWT carries { userId, role }; ownership compares userId.
export interface AuthUser {
  userId: number;
  role: Role;
  email?: string;
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
export function auth(req: Request, _res: Response, next: NextFunction): void {
  const devUser = req.header('x-dev-user');
  if (!config.isProduction && devUser) {
    try {
      req.user = JSON.parse(devUser) as AuthUser;
      return next();
    } catch {
      return next(ApiError.badRequest('Invalid x-dev-user header (must be JSON)'));
    }
  }

  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized('No token'));

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (typeof decoded === 'string') return next(ApiError.unauthorized('Invalid token'));
    const payload = decoded as JwtPayload;
    req.user = {
      userId: Number(payload.userId),
      role: payload.role as Role,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
    return next();
  } catch {
    return next(ApiError.unauthorized('Invalid token'));
  }
}
