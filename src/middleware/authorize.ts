import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
import type { Role } from './authenticate.js';

// Role-based access control. Must run after `authenticate`.
// Usage: router.post('/', authenticate, authorize('PROFESSOR', 'ADMIN'), handler)
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${allowedRoles.join(' or ')}`));
    }
    return next();
  };
}
