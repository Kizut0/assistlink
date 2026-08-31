import { Router } from 'express';
import { fail } from '../../utils/apiResponse.js';

// STUB — implemented in a later phase.
// Planned endpoints:
//   GET    /users          -> admin: list users
//   PATCH  /users/:id/role  -> admin: assign role
//   GET    /users/:id       -> admin: user detail
const router = Router();

router.use((_req, res) => fail(res, 501, 'users module not implemented yet'));

export default router;
