import { prisma } from '../../lib/prisma.js';
import type { UpsertProfileInput } from './profiles.validator.js';

// GET /me/profile: read-only. Returns null if the student hasn't saved a
// profile yet - PUT is what creates it, not this.
export function getMyProfile(userId: number) {
  return prisma.student.findUnique({ where: { userId } });
}

// PUT /me/profile: create or update, always scoped to the caller's own userId.
export function upsertMyProfile(userId: number, input: UpsertProfileInput) {
  return prisma.student.upsert({
    where: { userId },
    update: { ...input },
    create: { userId, ...input },
  });
}
