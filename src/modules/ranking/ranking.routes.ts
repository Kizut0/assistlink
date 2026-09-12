import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';
import * as controller from './ranking.controller.js';

// Exported for the canonical POST /posts/:id/rank route while the ranking
// provider remains isolated from the posts feature folder.
export const rankPost = [auth, requireRole('PROFESSOR', 'ADMIN'), asyncHandler(controller.rank)] as const;

const router = Router();
router.use((_req, res) => res.status(404).json({ success: false, error: { message: 'Ranking endpoint is /posts/:id/rank' } }));
export default router;
