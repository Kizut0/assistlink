import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
import type { Role } from './auth.js';

// Handbook Task 16 — role-based access control. Must run after `auth`.
// Usage: router.post('/', auth, requireRole('PROFESSOR', 'ADMIN'), handler)
export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (allowed.length > 0 && !allowed.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${allowed.join(' or ')}`));
    }
    return next();
  };
}
