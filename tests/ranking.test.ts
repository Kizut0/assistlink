import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config/index.js';
import { prisma } from '../src/lib/prisma.js';
import { ApiError } from '../src/utils/ApiError.js';
import { rankApplicants } from '../src/modules/ranking/gemini.service.js';
import * as rankingService from '../src/modules/ranking/ranking.service.js';

const originalFetch = globalThis.fetch;
const originalKey = config.GEMINI_API_KEY;
const originalModel = config.GEMINI_MODEL;
const originalBaseUrl = config.GEMINI_BASE_URL;
const originalPostFindUnique = prisma.post.findUnique;
const originalTransaction = prisma.$transaction;

afterEach(() => {
  globalThis.fetch = originalFetch;
  config.GEMINI_API_KEY = originalKey;
  config.GEMINI_MODEL = originalModel;
  config.GEMINI_BASE_URL = originalBaseUrl;
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

test('Gemini ranking uses structured JSON, sends only ranking inputs, and validates all applicants', async () => {
  config.GEMINI_API_KEY = 'test-key';
  config.GEMINI_MODEL = 'gemini-test';
  config.GEMINI_BASE_URL = 'https://gemini.test/v1beta';
  let request: RequestInit | undefined;
  globalThis.fetch = (async (_input, init) => {
    request = init;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ rankings: [
      { applicationId: 10, score: 91, rationale: 'Matches both required skills and describes relevant image-classification work.' },
      { applicationId: 11, score: 24, rationale: 'The provided profile does not demonstrate the required Python or TensorFlow experience.' },
    ] }) }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const result = await rankApplicants(post, applicants);
  assert.deepEqual(result.map(item => item.applicationId), [10, 11]);
  assert.equal(result[0].score, 91);
  assert.match(String(request?.body), /Computer vision research assistant/);
  assert.match(String(request?.body), /applicationId/);
  assert.doesNotMatch(String(request?.body), /alice@example|Alice Johnson/);
  assert.match(String(request?.body), /responseSchema/);
  assert.equal((request?.headers as Record<string, string>)['x-goog-api-key'], 'test-key');
});

test('ranking fails safely without a key, on invalid output, and at input limits', async () => {
  config.GEMINI_API_KEY = undefined;
  await assert.rejects(rankApplicants(post, applicants), (error: unknown) => error instanceof ApiError && error.statusCode === 503);
  config.GEMINI_API_KEY = 'test-key';
  globalThis.fetch = (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"rankings":[]}' }] } }] }), { status: 200 })) as typeof fetch;
  await assert.rejects(rankApplicants(post, applicants), (error: unknown) => error instanceof ApiError && error.statusCode === 502);
  await assert.rejects(rankApplicants(post, Array.from({ length: 51 }, (_, index) => ({ ...applicants[0], applicationId: index + 1 }))), (error: unknown) => error instanceof ApiError && error.statusCode === 422);
});

test('ranking persists only after the snapshot is unchanged and returns sorted staff results', async () => {
  config.GEMINI_API_KEY = 'test-key';
  const createdAt = new Date('2026-01-01T00:00:00Z');
  const snapshot = {
    id: 7, authorId: 1, title: post.title, details: post.details, requiredSkills: post.requiredSkills, jobCategory: post.jobCategory,
    applications: applicants.map(item => ({ id: item.applicationId, createdAt, student: { skills: item.skills, gpa: item.gpa, workHoursPerWeek: item.workHoursPerWeek, resumeText: item.resumeText, bio: item.bio } })),
  };
  prisma.post.findUnique = (async () => snapshot) as typeof originalPostFindUnique;
  let writes: unknown[] = [];
  prisma.$transaction = (async callback => callback({
    post: { findUnique: async () => snapshot },
    application: {
      update: async (args: unknown) => { writes.push(args); return args; },
      findMany: async () => [{ id: 10, aiScore: 91 }, { id: 11, aiScore: 24 }],
    },
  })) as typeof originalTransaction;
  globalThis.fetch = (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ rankings: [
    { applicationId: 10, score: 91, rationale: 'Strong match.' }, { applicationId: 11, score: 24, rationale: 'Limited evidence.' },
  ] }) }] } }] }), { status: 200 })) as typeof fetch;
  const result = await rankingService.rankPost(7, { userId: 1, role: 'PROFESSOR' });
  assert.deepEqual(result, [{ id: 10, aiScore: 91 }, { id: 11, aiScore: 24 }]);
  assert.equal(writes.length, 2);
});

test('ranking rejects a different owner', async () => {
  prisma.post.findUnique = (async () => ({ id: 7, authorId: 1, applications: [] })) as typeof originalPostFindUnique;
  await assert.rejects(rankingService.rankPost(7, { userId: 2, role: 'PROFESSOR' }), (error: unknown) => error instanceof ApiError && error.statusCode === 403);
});
