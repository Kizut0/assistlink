import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes.js';
import postsRoutes from '../modules/posts/posts.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import profilesRoutes from '../modules/profiles/profiles.routes.js';
import applicationsRoutes, {
  postApplicationsRoutes,
} from '../modules/applications/applications.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import rankingRoutes from '../modules/ranking/ranking.routes.js';
import eventsRoutes from '../modules/events/events.routes.js';
import peerRoutes from '../modules/peer/peer.routes.js';

const router = Router();

// Implemented
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/me', profilesRoutes);

// mounted before '/posts' so the more specific nested path wins the match
router.use('/posts/:postId/applications', postApplicationsRoutes);
router.use('/posts', postsRoutes);

router.use('/applications', applicationsRoutes);

// Stubs (return 501 until their phase lands)
router.use('/users', usersRoutes);
router.use('/ranking', rankingRoutes);
router.use('/events', eventsRoutes);
router.use('/peer', peerRoutes);

export default router;
