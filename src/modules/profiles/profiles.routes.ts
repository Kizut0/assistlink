import { Router } from 'express';
import { fail } from '../../utils/apiResponse.js';

// STUB — implemented in a later phase.
// Planned endpoints:
//   GET  /profiles/me    -> current student's profile
//   PUT  /profiles/me    -> create/update student profile (skills, gpa, resume, hours)
const router = Router();

router.use((_req, res) => fail(res, 501, 'profiles module not implemented yet'));

export default router;
