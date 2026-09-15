import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPostSchema, JOB_CATEGORIES, updatePostSchema } from '../src/modules/posts/posts.validator.js';

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
