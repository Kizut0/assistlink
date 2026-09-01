import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { auth } from '../../middleware/auth.js';
import * as controller from './auth.controller.js';

const router = Router();

// Public — the Microsoft AD sign-in flow.
router.get('/login', asyncHandler(controller.login));
router.get('/callback', asyncHandler(controller.callback));

// Protected — confirms auth works end to end.
router.get('/me', auth, asyncHandler(controller.me));

export default router;
