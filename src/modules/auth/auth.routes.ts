import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { auth } from '../../middleware/auth.js';
import * as controller from './auth.controller.js';
import { config } from '../../config/index.js';
import { ok } from '../../utils/apiResponse.js';

const router = Router();
router.get('/options', (_req, res) => ok(res, { development: !config.isProduction }));

// Public — the Microsoft AD sign-in flow.
router.get('/login', asyncHandler(controller.login));
router.get('/callback', asyncHandler(controller.callback));
router.post('/logout', asyncHandler(controller.logout));

// Protected — confirms auth works end to end.
router.get('/me', auth, asyncHandler(controller.me));

export default router;
