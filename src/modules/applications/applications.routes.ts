import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';
import { validate } from '../../middleware/validate.js';
import { decideApplicationSchema } from './applications.validator.js';
import * as controller from './applications.controller.js';

// mounted at /posts/:postId/applications (mergeParams so :postId is visible here)
const postApplicationsRoutes = Router({ mergeParams: true });

// Task 23 — a student applies to a post.
postApplicationsRoutes.post(
  '/',
  auth,
  requireRole('STUDENT'),
  asyncHandler(controller.apply),
);

// Task 24 — the owning professor (or an ADMIN) views the applicants.
// requireRole keeps students out; per-post ownership is enforced in the service.
postApplicationsRoutes.get(
  '/',
  auth,
  requireRole('PROFESSOR', 'ADMIN'),
  asyncHandler(controller.listApplicants),
);

export { postApplicationsRoutes };

// Task 25 — top-level /applications/:id, accept or reject.
const router = Router();

router.patch(
  '/:id',
  auth,
  requireRole('PROFESSOR', 'ADMIN'),
  validate(decideApplicationSchema),
  asyncHandler(controller.decide),
);

export default router;
