import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import type { AuthUser } from '../../middleware/auth.js';
import type { CreatePostInput, UpdatePostInput } from './posts.validator.js';

const authorSelect = { id: true, name: true, role: true } as const;

// Task 18 — open, non-private postings, newest first.
export function listPosts() {
  return prisma.post.findMany({
    where: { status: 'OPEN', private: false },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: authorSelect } },
  });
}

export async function getPost(id: number) {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: { select: authorSelect } },
  });
  if (!post) throw ApiError.notFound(`Post ${id} not found`);
  return post;
}

// Task 19 — authorId comes from the JWT, never the body, so ownership is recorded.
export function createPost(authorId: number, input: CreatePostInput) {
  return prisma.post.create({
    data: {
      title: input.title,
      details: input.details,
      requiredSkills: input.requiredSkills,
      jobCategory: input.jobCategory,
      private: input.private,
      authorId,
    },
  });
}

// Task 20 — ownership rule: only the author or an ADMIN may modify a post.
async function assertCanModify(id: number, requester: AuthUser) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw ApiError.notFound(`Post ${id} not found`);
  if (post.authorId !== requester.userId && requester.role !== 'ADMIN') {
    throw ApiError.forbidden('You can only modify your own posts');
  }
  return post;
}

export async function updatePost(id: number, requester: AuthUser, input: UpdatePostInput) {
  await assertCanModify(id, requester);
  return prisma.post.update({ where: { id }, data: input });
}

// Closing is just setting status CLOSED; Phase 04's apply route rejects closed posts.
export async function closePost(id: number, requester: AuthUser) {
  await assertCanModify(id, requester);
  return prisma.post.update({ where: { id }, data: { status: 'CLOSED' } });
}
