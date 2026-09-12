import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';
import { validate } from '../../middleware/validate.js';
import { upsertProfileSchema } from './profiles.validator.js';
import * as controller from './profiles.controller.js';
import { listMine } from '../applications/applications.controller.js';

// student profile CRUD, scoped to req.user.userId
// mounted at /me, so these become /assistlink/api/me/profile
const router = Router();

router.get('/applications', auth, requireRole('STUDENT'), asyncHandler(listMine));

router.get('/profile', auth, requireRole('STUDENT'), asyncHandler(controller.getMe));
router.put(
  '/profile',
  auth,
  requireRole('STUDENT'),
  validate(upsertProfileSchema),
  asyncHandler(controller.upsertMe),
);

export default router;
