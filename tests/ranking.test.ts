import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config/index.js';
import { prisma } from '../src/lib/prisma.js';
import { ApiError } from '../src/utils/ApiError.js';
import {
  GeminiProviderError,
  rankApplicants,
  verifyGeminiConnection,
} from '../src/modules/ranking/gemini.service.js';
import * as rankingService from '../src/modules/ranking/ranking.service.js';

const originalFetch = globalThis.fetch;
const originalKey = config.GEMINI_API_KEY;
const originalModel = config.GEMINI_MODEL;
const originalBaseUrl = config.GEMINI_BASE_URL;
const originalPostFindUnique = prisma.post.findUnique;
const originalTransaction = prisma.$transaction;
const originalConsoleError = console.error;

afterEach(() => {
  globalThis.fetch = originalFetch;
  config.GEMINI_API_KEY = originalKey;
  config.GEMINI_MODEL = originalModel;
  config.GEMINI_BASE_URL = originalBaseUrl;
  prisma.post.findUnique = originalPostFindUnique;
  prisma.$transaction = originalTransaction;
  console.error = originalConsoleError;
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
  assert.match(String(request?.body), /Built an image classifier/);
  assert.doesNotMatch(String(request?.body), /alice@example|Alice Johnson/);
  const requestJson = JSON.parse(String(request?.body)) as {
    generationConfig: {
      responseFormat?: { text?: { mimeType?: string; schema?: unknown } };
      responseSchema?: unknown;
      responseMimeType?: unknown;
    };
  };
  assert.equal(requestJson.generationConfig.responseFormat?.text?.mimeType, 'APPLICATION_JSON');
  assert.ok(requestJson.generationConfig.responseFormat?.text?.schema);
  assert.equal(requestJson.generationConfig.responseSchema, undefined);
  assert.equal(requestJson.generationConfig.responseMimeType, undefined);
  assert.equal((request?.headers as Record<string, string>)['x-goog-api-key'], 'test-key');
});

test('Gemini provider diagnostics classify 400 errors without logging secrets or applicant data', async () => {
  config.GEMINI_API_KEY = 'AIzaThisIsASecretGeminiApiKey123456';
  let requests = 0;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => { logs.push(args); };
  globalThis.fetch = (async () => {
    requests += 1;
    return new Response(JSON.stringify({
      error: {
        code: 400,
        status: 'INVALID_ARGUMENT',
        message: `API key ${config.GEMINI_API_KEY} not valid for Built an image classifier. alice@example.com`,
        details: [{ reason: 'API_KEY_INVALID' }],
      },
    }), { status: 400, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  await assert.rejects(
    rankApplicants(post, applicants, { sleep: async () => undefined }),
    (error: unknown) => error instanceof GeminiProviderError
      && error.statusCode === 503
      && error.diagnostic.reason === 'API_KEY_INVALID'
      && /credentials are invalid or expired/.test(error.message),
  );

  assert.equal(requests, 1);
  const logged = JSON.stringify(logs);
  assert.match(logged, /API_KEY_INVALID/);
  assert.match(logged, /\[REDACTED\]/);
  assert.doesNotMatch(logged, /AIzaThisIsASecretGeminiApiKey123456/);
  assert.doesNotMatch(logged, /Built an image classifier/);
  assert.doesNotMatch(logged, /alice@example\.com/);
});

test('Gemini provider diagnostics distinguish precondition and invalid request failures', async () => {
  config.GEMINI_API_KEY = 'test-key';
  console.error = () => undefined;
  const cases = [
    { googleStatus: 'FAILED_PRECONDITION', expectedStatus: 503, expectedMessage: /billing and regional eligibility/ },
    { googleStatus: 'INVALID_ARGUMENT', expectedStatus: 502, expectedMessage: /rejected the ranking request/ },
  ];

  for (const item of cases) {
    let requests = 0;
    globalThis.fetch = (async () => {
      requests += 1;
      return new Response(JSON.stringify({ error: { status: item.googleStatus, message: 'Safe provider diagnostic' } }), { status: 400 });
    }) as typeof fetch;
    await assert.rejects(
      rankApplicants(post, applicants, { sleep: async () => undefined }),
      (error: unknown) => error instanceof GeminiProviderError
        && error.statusCode === item.expectedStatus
        && item.expectedMessage.test(error.message),
    );
    assert.equal(requests, 1);
  }
});

test('Gemini retries transient HTTP failures with exponential backoff before succeeding', async () => {
  config.GEMINI_API_KEY = 'test-key';
  const delays: number[] = [];
  let requests = 0;
  console.error = () => undefined;
  globalThis.fetch = (async () => {
    requests += 1;
    if (requests === 1) return new Response(JSON.stringify({ error: { status: 'UNAVAILABLE' } }), { status: 503 });
    if (requests === 2) return new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } }), { status: 429 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ rankings: [
      { applicationId: 10, score: 91, rationale: 'Strong match.' },
      { applicationId: 11, score: 24, rationale: 'Limited evidence.' },
    ] }) }] } }] }), { status: 200 });
  }) as typeof fetch;

  const result = await rankApplicants(post, applicants, {
    random: () => 0,
    sleep: async milliseconds => { delays.push(milliseconds); },
  });

  assert.equal(requests, 3);
  assert.deepEqual(delays, [500, 1000]);
  assert.equal(result[0].score, 91);
});

test('Gemini returns the quota message after three exhausted rate-limit attempts', async () => {
  config.GEMINI_API_KEY = 'test-key';
  let requests = 0;
  console.error = () => undefined;
  globalThis.fetch = (async () => {
    requests += 1;
    return new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }), { status: 429 });
  }) as typeof fetch;

  await assert.rejects(
    rankApplicants(post, applicants, { random: () => 0, sleep: async () => undefined }),
    (error: unknown) => error instanceof GeminiProviderError
      && error.statusCode === 503
      && /rate limit reached/.test(error.message),
  );
  assert.equal(requests, 3);
});

test('Gemini permission failures are not retried', async () => {
  config.GEMINI_API_KEY = 'test-key';
  let requests = 0;
  console.error = () => undefined;
  globalThis.fetch = (async () => {
    requests += 1;
    return new Response(JSON.stringify({ error: { status: 'PERMISSION_DENIED', message: 'Permission denied' } }), { status: 403 });
  }) as typeof fetch;

  await assert.rejects(
    rankApplicants(post, applicants, { sleep: async () => undefined }),
    (error: unknown) => error instanceof GeminiProviderError
      && error.statusCode === 503
      && /do not have access/.test(error.message),
  );
  assert.equal(requests, 1);
});

test('Gemini retries timeouts three times and then returns a timeout error', async () => {
  config.GEMINI_API_KEY = 'test-key';
  const delays: number[] = [];
  let requests = 0;
  globalThis.fetch = (async () => {
    requests += 1;
    const error = new Error('request timed out');
    error.name = 'TimeoutError';
    throw error;
  }) as typeof fetch;

  await assert.rejects(
    rankApplicants(post, applicants, {
      random: () => 0,
      sleep: async milliseconds => { delays.push(milliseconds); },
    }),
    (error: unknown) => error instanceof ApiError && error.statusCode === 503 && /timed out/.test(error.message),
  );
  assert.equal(requests, 3);
  assert.deepEqual(delays, [500, 1000]);
});

test('Gemini verification uses the production structured-output request', async () => {
  config.GEMINI_API_KEY = 'test-key';
  config.GEMINI_MODEL = 'gemini-test';
  let request: RequestInit | undefined;
  globalThis.fetch = (async (_input, init) => {
    request = init;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"status":"OK"}' }] } }] }), { status: 200 });
  }) as typeof fetch;

  assert.deepEqual(await verifyGeminiConnection(), { model: 'gemini-test', httpStatus: 200 });
  assert.match(String(request?.body), /responseFormat/);
  assert.doesNotMatch(String(request?.body), /responseSchema/);
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
