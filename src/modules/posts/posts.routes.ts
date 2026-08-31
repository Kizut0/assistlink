import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as controller from './posts.controller.js';

const router = Router();

// Public reads
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.getOne));

// Protected writes — PROFESSOR or ADMIN; per-post ownership enforced in service.
router.post('/', authenticate, authorize('PROFESSOR', 'ADMIN'), asyncHandler(controller.create));
router.patch('/:id', authenticate, authorize('PROFESSOR', 'ADMIN'), asyncHandler(controller.update));
router.patch('/:id/close', authenticate, authorize('PROFESSOR', 'ADMIN'), asyncHandler(controller.close));

export default router;
