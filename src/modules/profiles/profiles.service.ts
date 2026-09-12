import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { isFacultyName, isMajorForFaculty } from './academic.js';
import type { UpsertProfileInput } from './profiles.validator.js';

const profileSelect = {
  id: true,
  major: true,
  skills: true,
  resumeUrl: true,
  resumeText: true,
  workHoursPerWeek: true,
  gpa: true,
  bio: true,
  user: { select: { department: { select: { name: true } } } },
} as const;

function presentProfile(profile: {
  id: number;
  major: string | null;
  skills: string[];
  resumeUrl: string | null;
  resumeText: string | null;
  workHoursPerWeek: number | null;
  gpa: number | null;
  bio: string | null;
  user: { department: { name: string } | null };
} | null) {
  if (!profile) return null;
  const { user, ...fields } = profile;
  return { ...fields, faculty: user.department?.name ?? null };
}

// GET /me/profile: read-only. Returns null if the student hasn't saved a
// profile yet - PUT is what creates it, not this.
export async function getMyProfile(userId: number) {
  return presentProfile(await prisma.student.findUnique({ where: { userId }, select: profileSelect }));
}

// PUT /me/profile: create or update, always scoped to the caller's own userId.
export async function upsertMyProfile(userId: number, input: UpsertProfileInput) {
  const current = await prisma.student.findUnique({
    where: { userId },
    select: { major: true, user: { select: { department: { select: { name: true } } } } },
  });
  const faculty = input.faculty === undefined ? current?.user.department?.name ?? null : input.faculty;
  const major = input.major === undefined ? current?.major ?? null : input.major;

  if (faculty !== null && faculty !== undefined && !isFacultyName(faculty)) {
    throw ApiError.badRequest('Choose a faculty from the available schools');
  }
  if (major !== null && major !== undefined && (!faculty || !isFacultyName(faculty) || !isMajorForFaculty(faculty, major))) {
    throw ApiError.badRequest('Choose a major offered by the selected faculty');
  }

  const { faculty: _faculty, major: _major, ...studentFields } = input;
  await prisma.user.update({
    where: { id: userId },
    data: input.faculty === undefined
      ? {}
      : input.faculty === null
        ? { department: { disconnect: true } }
        : { department: { connect: { name: input.faculty } } },
  });
  const profile = await prisma.student.upsert({
    where: { userId },
    update: { ...studentFields, ...(input.major === undefined ? {} : { major: input.major }) },
    create: { userId, ...studentFields, major: input.major ?? null },
    select: profileSelect,
  });
  return presentProfile(profile);
}
