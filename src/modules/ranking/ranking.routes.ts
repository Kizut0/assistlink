import { Router } from 'express';
import { fail } from '../../utils/apiResponse.js';

// STUB — implemented in a later phase.
// Planned endpoints:
//   POST /posts/:id/rank  -> OpenAI scores applicants (0-100 + rationale), sorted
const router = Router();

router.use((_req, res) => fail(res, 501, 'ranking module not implemented yet'));

export default router;
