import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma.js';
import { ApiError } from '../src/utils/ApiError.js';
import * as service from '../src/modules/profiles/profiles.service.js';

const originalStudentFindUnique = prisma.student.findUnique;
const originalStudentUpsert = prisma.student.upsert;
const originalUserUpdate = prisma.user.update;

afterEach(() => {
  prisma.student.findUnique = originalStudentFindUnique;
  prisma.student.upsert = originalStudentUpsert;
  prisma.user.update = originalUserUpdate;
});

test('student profiles return faculty and major and accept matching updates', async () => {
  const saved = {
    id: 10,
    major: 'Computer Science',
    skills: ['TypeScript'],
    resumeUrl: null,
    resumeText: null,
    workHoursPerWeek: 10,
    gpa: 3.8,
    bio: 'Builder',
    user: { department: { name: 'Vincent Mary School of Engineering, Science and Technology' } },
  };
  let currentLookup = true;
  let updateArgs: unknown;
  prisma.student.findUnique = (async () => currentLookup ? { major: null, user: { department: null } } : saved) as typeof originalStudentFindUnique;
  prisma.user.update = (async args => { updateArgs = args; return {} as never; }) as typeof originalUserUpdate;
  prisma.student.upsert = (async () => { currentLookup = false; return saved; }) as typeof originalStudentUpsert;

  const result = await service.upsertMyProfile(10, {
    faculty: 'Vincent Mary School of Engineering, Science and Technology',
    major: 'Computer Science',
    skills: ['TypeScript'],
  });
  assert.equal(result?.faculty, 'Vincent Mary School of Engineering, Science and Technology');
  assert.equal(result?.major, 'Computer Science');
  assert.deepEqual((updateArgs as { data: unknown }).data, {
    department: { connect: { name: 'Vincent Mary School of Engineering, Science and Technology' } },
  });
});

test('student profiles reject a major from another faculty', async () => {
  prisma.student.findUnique = (async () => ({ major: null, user: { department: null } })) as typeof originalStudentFindUnique;
  let updated = false;
  prisma.user.update = (async () => { updated = true; return {} as never; }) as typeof originalUserUpdate;
  await assert.rejects(
    service.upsertMyProfile(10, { faculty: 'Theodore Maria School of Arts', major: 'Computer Science' }),
    (error: unknown) => error instanceof ApiError && error.statusCode === 400,
  );
  assert.equal(updated, false);
});
