import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';
import { validate } from '../../middleware/validate.js';
import { createPostSchema, updatePostSchema } from './posts.validator.js';
import * as controller from './posts.controller.js';
import { rankPost } from '../ranking/ranking.routes.js';

const router = Router();

// Task 18 — reads require authentication (any signed-in role).
router.get('/', auth, asyncHandler(controller.list));
router.get('/workspace', auth, requireRole('PROFESSOR', 'ADMIN'), asyncHandler(controller.workspace));
router.get('/:id', auth, asyncHandler(controller.getOne));

// Tasks 19/20 — writes are PROFESSOR/ADMIN; ownership enforced in the service.
router.post(
  '/',
  auth,
  requireRole('PROFESSOR', 'ADMIN'),
  validate(createPostSchema),
  asyncHandler(controller.create),
);
router.patch(
  '/:id',
  auth,
  requireRole('PROFESSOR', 'ADMIN'),
  validate(updatePostSchema),
  asyncHandler(controller.update),
);

router.post('/:id/rank', ...rankPost);
router.patch(
  '/:id/close',
  auth,
  requireRole('PROFESSOR', 'ADMIN'),
  asyncHandler(controller.close),
);

export default router;
