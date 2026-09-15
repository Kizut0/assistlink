import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config/index.js';
import { ApiError } from '../src/utils/ApiError.js';
import {
  OpenRouterProviderError,
  rankApplicants,
  verifyOpenRouterConnection,
} from '../src/modules/ranking/openrouter.service.js';

const originalFetch = globalThis.fetch;
const originalKey = config.OPENROUTER_API_KEY;
const originalModel = config.OPENROUTER_MODEL;
const originalBaseUrl = config.OPENROUTER_BASE_URL;
const originalConsoleError = console.error;

afterEach(() => {
  globalThis.fetch = originalFetch;
  config.OPENROUTER_API_KEY = originalKey;
  config.OPENROUTER_MODEL = originalModel;
  config.OPENROUTER_BASE_URL = originalBaseUrl;
  console.error = originalConsoleError;
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
    { applicationId: 10, score: 91, rationale: 'Matches both required skills and describes relevant image-classification work.' },
    { applicationId: 11, score: 24, rationale: 'The provided profile does not demonstrate the required Python or TensorFlow experience.' },
  ] }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('OpenRouter ranking uses the OpenAI-compatible structured-output request and preserves résumé input', async () => {
  config.OPENROUTER_API_KEY = 'sk-or-v1-test-key';
  config.OPENROUTER_MODEL = 'openai/gpt-oss-20b:free';
  config.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';
  let input = '';
  let request: RequestInit | undefined;
  globalThis.fetch = (async (url, init) => {
    input = String(url);
    request = init;
    return rankingResponse();
  }) as typeof fetch;

  const result = await rankApplicants(post, applicants);
  assert.deepEqual(result.map(item => item.applicationId), [10, 11]);
  assert.equal(result[0].score, 91);
  assert.equal(input, 'https://openrouter.test/api/v1/chat/completions');
  const body = JSON.parse(String(request?.body)) as Record<string, any>;
  assert.equal(body.model, 'openai/gpt-oss-20b:free');
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(body.response_format.json_schema.strict, true);
  assert.ok(body.response_format.json_schema.schema);
  assert.equal(body.provider.require_parameters, true);
  assert.match(body.messages[0].content, /Built an image classifier/);
  assert.equal((request?.headers as Record<string, string>).Authorization, 'Bearer sk-or-v1-test-key');
});

test('OpenRouter diagnostics redact credentials and applicant content', async () => {
  config.OPENROUTER_API_KEY = 'sk-or-v1-secret-key';
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => { logs.push(args); };
  globalThis.fetch = (async () => new Response(JSON.stringify({
    error: {
      code: 400,
      status: 'INVALID_ARGUMENT',
      message: `Key sk-or-v1-secret-key rejected Built an image classifier for alice@example.com`,
    },
  }), { status: 400, headers: { 'content-type': 'application/json' } })) as typeof fetch;

  await assert.rejects(
    rankApplicants(post, applicants, { sleep: async () => undefined }),
    (error: unknown) => error instanceof OpenRouterProviderError
      && error.statusCode === 502
      && /rejected the ranking request/.test(error.message),
  );
  const logged = JSON.stringify(logs);
  assert.match(logged, /INVALID_ARGUMENT/);
  assert.doesNotMatch(logged, /sk-or-v1-secret-key/);
  assert.doesNotMatch(logged, /Built an image classifier/);
  assert.doesNotMatch(logged, /alice@example\.com/);
});

test('OpenRouter retries transient failures and does not retry invalid requests', async () => {
  config.OPENROUTER_API_KEY = 'test-key';
  const delays: number[] = [];
  let requests = 0;
  console.error = () => undefined;
  globalThis.fetch = (async () => {
    requests += 1;
    if (requests === 1) return new Response(JSON.stringify({ error: { status: 'INTERNAL_SERVER_ERROR' } }), { status: 503 });
    if (requests === 2) return new Response(JSON.stringify({ error: { status: 'RATE_LIMITED' } }), { status: 429 });
    return rankingResponse();
  }) as typeof fetch;
  const result = await rankApplicants(post, applicants, {
    random: () => 0,
    sleep: async milliseconds => { delays.push(milliseconds); },
  });
  assert.equal(requests, 3);
  assert.deepEqual(delays, [500, 1000]);
  assert.equal(result[0].score, 91);

  requests = 0;
  globalThis.fetch = (async () => {
    requests += 1;
    return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT' } }), { status: 400 });
  }) as typeof fetch;
  await assert.rejects(rankApplicants(post, applicants, { sleep: async () => undefined }), OpenRouterProviderError);
  assert.equal(requests, 1);
});

test('OpenRouter verification uses the same structured request and reports the configured model', async () => {
  config.OPENROUTER_API_KEY = 'test-key';
  config.OPENROUTER_MODEL = 'openai/gpt-oss-20b:free';
  let request: RequestInit | undefined;
  globalThis.fetch = (async (_input, init) => {
    request = init;
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"status":"OK"}' } }] }), { status: 200 });
  }) as typeof fetch;
  assert.deepEqual(await verifyOpenRouterConnection(), { model: 'openai/gpt-oss-20b:free', httpStatus: 200 });
  const body = JSON.parse(String(request?.body)) as Record<string, any>;
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(body.response_format.json_schema.name, 'assistlink_ranking');
});

test('OpenRouter ranking fails clearly when the key is unavailable', async () => {
  config.OPENROUTER_API_KEY = undefined;
  await assert.rejects(
    rankApplicants(post, applicants),
    (error: unknown) => error instanceof ApiError && error.statusCode === 503 && /not configured/.test(error.message),
  );
});
