import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

// Application.studentId points at Student.id, not User.id, so we need to
// look up the caller's own Student row from their JWT userId first. If they
// haven't saved a profile yet, tell them to do that instead of creating one
// silently here.
async function getStudentIdForUser(userId: number): Promise<number> {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) {
    throw ApiError.badRequest(
      'Complete your student profile before applying (PUT /assistlink/api/profiles/me)',
    );
  }
  return student.id;
}

export async function applyToPost(userId: number, postId: number) {
  const studentId = await getStudentIdForUser(userId);

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw ApiError.notFound(`Post ${postId} not found`);
  if (post.status !== 'OPEN') {
    throw ApiError.badRequest('This post is closed and no longer accepting applications');
  }

  const existing = await prisma.application.findFirst({ where: { postId, studentId } });
  if (existing) throw ApiError.conflict('You have already applied to this post');

  return prisma.application.create({ data: { postId, studentId } });
}
