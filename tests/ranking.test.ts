import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config/index.js';
import { prisma } from '../src/lib/prisma.js';
import { ApiError } from '../src/utils/ApiError.js';
import * as rankingService from '../src/modules/ranking/ranking.service.js';

const originalFetch = globalThis.fetch;
const originalKey = config.OPENROUTER_API_KEY;
const originalModel = config.OPENROUTER_MODEL;
const originalBaseUrl = config.OPENROUTER_BASE_URL;
const originalProvider = config.RANKING_PROVIDER;
const originalPostFindUnique = prisma.post.findUnique;
const originalTransaction = prisma.$transaction;

afterEach(() => {
  globalThis.fetch = originalFetch;
  config.OPENROUTER_API_KEY = originalKey;
  config.OPENROUTER_MODEL = originalModel;
  config.OPENROUTER_BASE_URL = originalBaseUrl;
  config.RANKING_PROVIDER = originalProvider;
  prisma.post.findUnique = originalPostFindUnique;
  prisma.$transaction = originalTransaction;
  rankingService.__resetRankingGuardForTests();
});

const post = {
  title: 'Computer vision research assistant',
  details: 'Build image classification experiments with Python. Prior research experience is preferred.',
  requiredSkills: ['Python', 'TensorFlow'],
  jobCategory: 'RA',
};
const applicants = [
  { applicationId: 10, skills: ['Python', 'TensorFlow'], gpa: 3.8, workHoursPerWeek: 10, resumeText: 'Built an image classifier.', bio: 'Interested in ML.' },
  { applicationId: 11, skills: ['Java'], gpa: null, workHoursPerWeek: null, resumeText: null, bio: null },
];

function rankingResponse() {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ rankings: [
    { applicationId: 10, score: 91, rationale: 'Strong match.' },
    { applicationId: 11, score: 24, rationale: 'Limited evidence.' },
  ] }) } }] }), { status: 200 });
}

test('ranking persists OpenRouter scores only after the applicant snapshot is unchanged', async () => {
  config.RANKING_PROVIDER = 'openrouter';
  config.OPENROUTER_API_KEY = 'test-key';
  config.OPENROUTER_MODEL = 'openai/gpt-oss-20b';
  const createdAt = new Date('2026-01-01T00:00:00Z');
  const snapshot = {
    id: 7, authorId: 1, title: post.title, details: post.details, requiredSkills: post.requiredSkills, jobCategory: post.jobCategory,
    applications: applicants.map(item => ({ id: item.applicationId, createdAt, student: { skills: item.skills, gpa: item.gpa, workHoursPerWeek: item.workHoursPerWeek, resumeText: item.resumeText, bio: item.bio } })),
  };
  prisma.post.findUnique = (async () => snapshot) as typeof originalPostFindUnique;
  const writes: unknown[] = [];
  prisma.$transaction = (async callback => callback({
    post: { findUnique: async () => snapshot },
    application: {
      update: async (args: unknown) => { writes.push(args); return args; },
      findMany: async () => [{ id: 10, aiScore: 91 }, { id: 11, aiScore: 24 }],
    },
  })) as typeof originalTransaction;
  globalThis.fetch = (async () => rankingResponse()) as typeof fetch;

  const result = await rankingService.rankPost(7, { userId: 1, role: 'PROFESSOR' });
  assert.deepEqual(result, [{ id: 10, aiScore: 91 }, { id: 11, aiScore: 24 }]);
  assert.equal(writes.length, 2);
});

test('ranking rejects a different owner before calling OpenRouter', async () => {
  config.RANKING_PROVIDER = 'openrouter';
  prisma.post.findUnique = (async () => ({ id: 7, authorId: 1, applications: [] })) as typeof originalPostFindUnique;
  await assert.rejects(
    rankingService.rankPost(7, { userId: 2, role: 'PROFESSOR' }),
    (error: unknown) => error instanceof ApiError && error.statusCode === 403,
  );
});

test('ranking refuses an unsupported provider configuration', async () => {
  config.RANKING_PROVIDER = 'unsupported';
  prisma.post.findUnique = (async () => ({
    id: 7,
    authorId: 1,
    title: post.title,
    details: post.details,
    requiredSkills: post.requiredSkills,
    jobCategory: post.jobCategory,
    applications: [{
      id: 10,
      createdAt: new Date(),
      student: { major: null, skills: [], gpa: null, workHoursPerWeek: null, resumeText: null, bio: null, user: null },
    }],
  })) as typeof originalPostFindUnique;
  await assert.rejects(
    rankingService.rankPost(7, { userId: 1, role: 'PROFESSOR' }),
    (error: unknown) => error instanceof ApiError && error.statusCode === 503 && /OpenRouter ranking is not enabled/.test(error.message),
  );
});
