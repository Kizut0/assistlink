import { prisma } from '../../lib/prisma.js';
import type { UpsertProfileInput } from './profiles.validator.js';

// GET /profiles/me: a fresh STUDENT user won't have a Student row until they
// save one, so we just upsert an empty one here instead of 404ing on them.
export function getMyProfile(userId: number) {
  return prisma.student.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

// PUT /profiles/me: create or update, always scoped to the caller's own userId.
export function upsertMyProfile(userId: number, input: UpsertProfileInput) {
  return prisma.student.upsert({
    where: { userId },
    update: { ...input },
    create: { userId, ...input },
  });
}
