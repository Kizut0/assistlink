import { Router } from 'express';
import { fail } from '../../utils/apiResponse.js';

// STUB — implemented in a later phase.
// Planned endpoints:
//   GET /peer/v1/events/:externalEventId/registrations
//        -> exposed to partner backend, protected by x-api-key
const router = Router();

router.use((_req, res) => fail(res, 501, 'peer module not implemented yet'));

export default router;
