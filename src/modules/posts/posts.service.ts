import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import type { AuthUser } from '../../middleware/authenticate.js';
import type { CreatePostInput, UpdatePostInput } from './posts.validator.js';

const authorSelect = { id: true, name: true, role: true } as const;

export function listPosts() {
  return prisma.post.findMany({
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

export function createPost(authorId: number, input: CreatePostInput) {
  return prisma.post.create({
    data: {
      title: input.title,
      content: input.content,
      requiredSkills: input.requiredSkills,
      authorId,
    },
  });
}

// Ownership rule: only the author or an ADMIN may modify a post.
async function assertCanModify(id: number, requester: AuthUser) {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw ApiError.notFound(`Post ${id} not found`);
  if (post.authorId !== requester.id && requester.role !== 'ADMIN') {
    throw ApiError.forbidden('You can only modify your own posts');
  }
  return post;
}

export async function updatePost(id: number, requester: AuthUser, input: UpdatePostInput) {
  await assertCanModify(id, requester);
  return prisma.post.update({ where: { id }, data: input });
}

export async function closePost(id: number, requester: AuthUser) {
  await assertCanModify(id, requester);
  return prisma.post.update({ where: { id }, data: { status: 'CLOSED' } });
}
