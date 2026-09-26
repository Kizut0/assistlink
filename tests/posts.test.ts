import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPostSchema, JOB_CATEGORIES, updatePostSchema } from '../src/modules/posts/posts.validator.js';
import { prisma } from '../src/lib/prisma.js';
import { getPost } from '../src/modules/posts/posts.service.js';
import { applyToPost } from '../src/modules/applications/applications.service.js';

test('every supported opportunity type is accepted for creating and editing posts', () => {
  assert.deepEqual(JOB_CATEGORIES, [
    'RA',
    'TA',
    'INTERNSHIP',
    'PROJECT_ASSISTANT',
    'LAB_ASSISTANT',
    'PEER_TUTOR',
  ]);
  for (const jobCategory of JOB_CATEGORIES) {
    assert.equal(createPostSchema.safeParse({ title: 'Campus opportunity', details: 'A useful role', jobCategory }).success, true);
    assert.equal(updatePostSchema.safeParse({ jobCategory }).success, true);
  }
});

test('unknown opportunity types remain rejected', () => {
  assert.equal(createPostSchema.safeParse({ title: 'Campus opportunity', details: 'A useful role', jobCategory: 'OTHER' }).success, false);
  assert.equal(updatePostSchema.safeParse({ jobCategory: 'OTHER' }).success, false);
});

test('private posts cannot be enumerated or applied to by other students', async () => {
  const originalPost = prisma.post.findUnique;
  const originalApplication = prisma.application.findFirst;
  const originalStudent = prisma.student.findUnique;
  const post = { id: 7, authorId: 1, private: true, status: 'OPEN' };
  let hasApplication = false;
  prisma.post.findUnique = (async () => post) as typeof originalPost;
  prisma.application.findFirst = (async () => hasApplication ? { id: 12 } : null) as typeof originalApplication;
  prisma.student.findUnique = (async () => ({ id: 9 })) as typeof originalStudent;
  try {
    await assert.rejects(getPost(7, { userId: 3, role: 'STUDENT' }), { statusCode: 404 });
    await assert.rejects(getPost(7, { userId: 2, role: 'PROFESSOR' }), { statusCode: 404 });
    await assert.rejects(applyToPost(3, 7), { statusCode: 404 });
    assert.equal((await getPost(7, { userId: 1, role: 'PROFESSOR' })).id, 7);
    assert.equal((await getPost(7, { userId: 2, role: 'ADMIN' })).id, 7);
    hasApplication = true;
    assert.equal((await getPost(7, { userId: 3, role: 'STUDENT' })).id, 7);
  } finally {
    prisma.post.findUnique = originalPost;
    prisma.application.findFirst = originalApplication;
    prisma.student.findUnique = originalStudent;
  }
});
