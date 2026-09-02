import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';
import { fail } from '../../utils/apiResponse.js';
import * as controller from './applications.controller.js';

// mounted at /posts/:postId/applications (mergeParams so :postId is visible here)
// POST is the apply endpoint. GET (view applicants) isn't built yet.
const postApplicationsRoutes = Router({ mergeParams: true });

postApplicationsRoutes.post(
  '/',
  auth,
  requireRole('STUDENT'),
  asyncHandler(controller.apply),
);

postApplicationsRoutes.get('/', auth, requireRole('PROFESSOR', 'ADMIN'), (_req, res) =>
  fail(res, 501, 'applicant listing not implemented yet'),
);

export { postApplicationsRoutes };

// top-level /applications/:id, for accept/reject - not built yet
const router = Router();

router.patch('/:id', auth, (_req, res) =>
  fail(res, 501, 'application decision not implemented yet'),
);

export default router;
