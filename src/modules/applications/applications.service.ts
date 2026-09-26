import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import type { AuthUser } from '../../middleware/auth.js';
import type { DecideApplicationInput } from './applications.validator.js';

export function listMyApplications(userId: number) {
  return prisma.application.findMany({
    where: { student: { userId } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      postId: true,
      post: { include: { author: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Application.studentId points at Student.id, not User.id, so we need to
// look up the caller's own Student row from their JWT userId first. If they
// haven't saved a profile yet, tell them to do that instead of creating one
// silently here.
async function getStudentIdForUser(userId: number): Promise<number> {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) {
    throw ApiError.badRequest(
      'Complete your student profile before applying (PUT /assistlink/api/me/profile)',
    );
  }
  return student.id;
}

// Tasks 24/25 — the owning professor (or an ADMIN) may view and decide on a
// post's applicants. Mirrors the ownership rule in posts.service.
async function assertOwnsPost(postId: number, actor: AuthUser) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw ApiError.notFound(`Post ${postId} not found`);
  if (post.authorId !== actor.userId && actor.role !== 'ADMIN') {
    throw ApiError.forbidden('You can only manage applicants for your own posts');
  }
  return post;
}

// What the owning professor sees for each applicant: the student profile fields
// they need to judge a candidate, plus the Phase 05 AI columns.
const applicantSelect = {
  id: true,
  status: true,
  aiScore: true,
  aiRationale: true,
  createdAt: true,
  postId: true,
  student: {
    select: {
      id: true,
      major: true,
      skills: true,
      gpa: true,
      workHoursPerWeek: true,
      resumeUrl: true,
      resumeText: true,
      resumeFileName: true,
      resumeMimeType: true,
      resumeSizeBytes: true,
      resumeUploadedAt: true,
      bio: true,
      user: { select: { id: true, name: true, email: true, department: { select: { name: true } } } },
    },
  },
} as const;

export async function applyToPost(userId: number, postId: number) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw ApiError.notFound(`Post ${postId} not found`);
  if (post.private) throw ApiError.notFound(`Post ${postId} not found`);
  if (post.status !== 'OPEN') {
    throw ApiError.badRequest('This post is closed and no longer accepting applications');
  }
  const studentId = await getStudentIdForUser(userId);

  const existing = await prisma.application.findFirst({ where: { postId, studentId } });
  if (existing) throw ApiError.conflict('You have already applied to this post');

  try {
    return await prisma.application.create({
      data: { postId, studentId },
      select: { id: true, postId: true, status: true, createdAt: true },
    });
  } catch (e) {
    // findFirst above catches the normal case; this only fires if two requests
    // land at the same time and both pass the check before either commits.
    if ((e as { code?: string }).code === 'P2002') {
      throw ApiError.conflict('You have already applied to this post');
    }
    throw e;
  }
}

// Task 24 — GET /posts/:postId/applications.
// Ordered best-first. `nulls: 'last'` matters: aiScore is null until Phase 05
// runs the ranking, and Postgres sorts NULLs first on DESC by default, which
// would push unranked applicants above ranked ones. This way the ordering is
// correct both before and after Task 28.
export async function listApplicants(postId: number, actor: AuthUser) {
  await assertOwnsPost(postId, actor);
  return prisma.application.findMany({
    where: { postId },
    select: applicantSelect,
    orderBy: [{ aiScore: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
  });
}

// Task 25 — PATCH /applications/:id. Ownership is resolved through the
// application's post, so only that post's author (or an ADMIN) can decide.
export async function decideApplication(
  applicationId: number,
  actor: AuthUser,
  input: DecideApplicationInput,
) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, postId: true },
  });
  if (!application) throw ApiError.notFound(`Application ${applicationId} not found`);

  await assertOwnsPost(application.postId, actor);

  return prisma.application.update({
    where: { id: applicationId },
    data: { status: input.status },
    select: applicantSelect,
  });
}
