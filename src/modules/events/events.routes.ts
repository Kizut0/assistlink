import { Router } from 'express';
import { fail } from '../../utils/apiResponse.js';

// STUB — implemented in a later phase.
// Planned endpoints:
//   GET  /events              -> consume partner API event list
//   POST /events/:id/register -> register a student for a partner event
const router = Router();

router.use((_req, res) => fail(res, 501, 'events module not implemented yet'));

export default router;
