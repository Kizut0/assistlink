import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { assignRoleSchema } from './users.validator.js';
import * as controller from './users.controller.js';

const router = Router();
router.use(auth, requireRole('ADMIN'));
router.get('/', asyncHandler(controller.list));
router.patch('/:id/role', validate(assignRoleSchema), asyncHandler(controller.assignRole));
export default router;
