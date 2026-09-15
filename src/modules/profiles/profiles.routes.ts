import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';
import { validate } from '../../middleware/validate.js';
import { upsertProfileSchema } from './profiles.validator.js';
import * as controller from './profiles.controller.js';
import { listMine } from '../applications/applications.controller.js';
import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError.js';
import { MAX_RESUME_BYTES } from './resumes.service.js';

// student profile CRUD, scoped to req.user.userId
// mounted at /me, so these become /assistlink/api/me/profile
const router = Router();
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_BYTES, files: 1, fields: 0, parts: 1 },
}).single('resume');

function acceptResume(req: Request, res: Response, next: NextFunction): void {
  resumeUpload(req, res, error => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new ApiError(413, 'Résumé PDFs must be 5 MB or smaller'));
    } else if (error) {
      next(ApiError.badRequest('Upload exactly one PDF using the resume field'));
    } else {
      next();
    }
  });
}

router.get('/applications', auth, requireRole('STUDENT'), asyncHandler(listMine));

router.get('/profile', auth, requireRole('STUDENT'), asyncHandler(controller.getMe));
router.put(
  '/profile',
  auth,
  requireRole('STUDENT'),
  validate(upsertProfileSchema),
  asyncHandler(controller.upsertMe),
);
router.post('/resume', auth, requireRole('STUDENT'), acceptResume, asyncHandler(controller.uploadResume));
router.get('/resume', auth, requireRole('STUDENT'), asyncHandler(controller.getResume));
router.delete('/resume', auth, requireRole('STUDENT'), asyncHandler(controller.deleteResume));

export default router;
