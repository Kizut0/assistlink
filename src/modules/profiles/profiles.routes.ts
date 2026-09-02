import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';
import { validate } from '../../middleware/validate.js';
import { upsertProfileSchema } from './profiles.validator.js';
import * as controller from './profiles.controller.js';

// student profile CRUD, scoped to req.user.userId
const router = Router();

router.get('/me', auth, requireRole('STUDENT'), asyncHandler(controller.getMe));
router.put(
  '/me',
  auth,
  requireRole('STUDENT'),
  validate(upsertProfileSchema),
  asyncHandler(controller.upsertMe),
);

export default router;
