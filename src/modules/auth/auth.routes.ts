import { Router } from 'express';
import { fail } from '../../utils/apiResponse.js';

// STUB — implemented in a later phase.
// Planned endpoints:
//   GET  /auth/login     -> redirect to Microsoft AD (OIDC)
//   GET  /auth/callback  -> exchange code, upsert user, issue JWT
//   GET  /auth/me        -> current user from JWT
const router = Router();

router.use((_req, res) => fail(res, 501, 'auth module not implemented yet'));

export default router;
