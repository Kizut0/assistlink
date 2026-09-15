import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import type { AuthUser } from '../../middleware/auth.js';
import { config } from '../../config/index.js';
import { rankApplicants as rankGeminiApplicants } from './gemini.service.js';
import { rankApplicants as rankOpenRouterApplicants } from './openrouter.service.js';

const running = new Set<number>();

function snapshotKey(post: {
  authorId: number;
  title: string;
  details: string;
  requiredSkills: string[];
  jobCategory: string;
  applications: Array<{
    id: number;
    createdAt: Date;
    student: { major?: string | null; skills: string[]; gpa: number | null; workHoursPerWeek: number | null; resumeText: string | null; bio: string | null; user?: { department: { name: string } | null } };
  }>;
}) {
  return JSON.stringify({
    authorId: post.authorId,
    title: post.title,
    details: post.details,
    requiredSkills: post.requiredSkills,
    jobCategory: post.jobCategory,
    applications: post.applications.map(application => ({
      id: application.id,
      createdAt: application.createdAt.toISOString(),
      student: application.student,
    })),
  });
}

function assertOwner(post: { authorId: number } | null, actor: AuthUser) {
  if (!post) throw ApiError.notFound('Post not found');
  if (post.authorId !== actor.userId && actor.role !== 'ADMIN') throw ApiError.forbidden('You can only rank applicants for your own posts');
}

function rankApplicantsWithConfiguredProvider(
  post: Parameters<typeof rankGeminiApplicants>[0],
  applicants: Parameters<typeof rankGeminiApplicants>[1],
) {
  if (config.RANKING_PROVIDER === 'openrouter') return rankOpenRouterApplicants(post, applicants);
  if (config.RANKING_PROVIDER === 'gemini') return rankGeminiApplicants(post, applicants);
  throw new ApiError(503, `Unsupported ranking provider: ${config.RANKING_PROVIDER}`);
}

export async function rankPost(postId: number, actor: AuthUser) {
  if (running.has(postId)) throw ApiError.conflict('Ranking is already running for this posting');
  running.add(postId);
  try {
    const snapshot = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true, authorId: true, title: true, details: true, requiredSkills: true, jobCategory: true,
        applications: { select: { id: true, createdAt: true, student: { select: { major: true, skills: true, gpa: true, workHoursPerWeek: true, resumeText: true, bio: true, user: { select: { department: { select: { name: true } } } } } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    assertOwner(snapshot, actor);
    if (!snapshot) throw ApiError.notFound('Post not found');
    if (snapshot.applications.length === 0) return [];
    const applicants = snapshot.applications.map(application => ({
      applicationId: application.id,
      major: application.student.major ?? null,
      faculty: application.student.user?.department?.name ?? null,
      skills: application.student.skills,
      gpa: application.student.gpa,
      workHoursPerWeek: application.student.workHoursPerWeek,
      resumeText: application.student.resumeText,
      bio: application.student.bio,
    }));
    const rankings = await rankApplicantsWithConfiguredProvider(snapshot, applicants);
    return await prisma.$transaction(async tx => {
      const current = await tx.post.findUnique({
        where: { id: postId },
        select: { authorId: true, title: true, details: true, requiredSkills: true, jobCategory: true, applications: { select: { id: true, createdAt: true, student: { select: { major: true, skills: true, gpa: true, workHoursPerWeek: true, resumeText: true, bio: true, user: { select: { department: { select: { name: true } } } } } } }, orderBy: { createdAt: 'asc' } } },
      });
      assertOwner(current, actor);
      if (!current || snapshotKey(current) !== snapshotKey(snapshot)) {
        throw ApiError.conflict('The posting or applicants changed while ranking. Refresh and try again.');
      }
      await Promise.all(rankings.map(item => tx.application.update({ where: { id: item.applicationId }, data: { aiScore: item.score, aiRationale: item.rationale } })));
      return tx.application.findMany({
        where: { postId }, select: { id: true, status: true, aiScore: true, aiRationale: true, createdAt: true, postId: true, student: { select: { id: true, major: true, skills: true, gpa: true, workHoursPerWeek: true, resumeUrl: true, resumeText: true, bio: true, user: { select: { id: true, name: true, email: true, department: { select: { name: true } } } } } } },
        orderBy: [{ aiScore: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
      });
    });
  } finally { running.delete(postId); }
}

export function __resetRankingGuardForTests() { running.clear(); }
