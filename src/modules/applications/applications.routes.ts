import { Router } from 'express';
import { fail } from '../../utils/apiResponse.js';

// STUB — implemented in a later phase.
// Planned endpoints:
//   POST  /posts/:id/applications  -> student applies to a post
//   GET   /posts/:id/applications  -> post author sees applicants
//   PATCH /applications/:id        -> accept / reject
const router = Router();

router.use((_req, res) => fail(res, 501, 'applications module not implemented yet'));

export default router;
