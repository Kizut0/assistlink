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

const router = Router();

// Implemented
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/me', profilesRoutes);

// mounted before '/posts' so the more specific nested path wins the match
router.use('/posts/:postId/applications', postApplicationsRoutes);
router.use('/posts', postsRoutes);

router.use('/applications', applicationsRoutes);

router.use('/users', usersRoutes);

// Legacy compatibility route. Ranking's canonical endpoint is /posts/:id/rank.
router.use('/ranking', rankingRoutes);

export default router;
