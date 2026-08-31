import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';

export type Role = 'PROFESSOR' | 'FACULTY' | 'ADMIN' | 'STUDENT';

export interface AuthUser {
  id: number;
  role: Role;
  email: string;
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

// PLACEHOLDER (Phase 3 fills this in with real Microsoft AD / JWT verification).
// For now, in non-production only, a caller may impersonate a user by sending an
// `x-dev-user` header with JSON like: {"id":1,"role":"PROFESSOR","email":"a@b.edu"}.
// Everything else is rejected with 401.
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const devUser = req.header('x-dev-user');
  if (!config_isProduction() && devUser) {
    try {
      req.user = JSON.parse(devUser) as AuthUser;
      return next();
    } catch {
      return next(ApiError.badRequest('Invalid x-dev-user header (must be JSON)'));
    }
  }
  return next(ApiError.unauthorized('Authentication not implemented yet (Phase 3)'));
}

function config_isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
