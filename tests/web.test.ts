import { after, before, beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { config } from '../src/config/index.js';
import { prisma } from '../src/lib/prisma.js';

const server = app.listen(0, '127.0.0.1');
let base: string;
before(async () => {
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  base = `http://127.0.0.1:${address.port}`;
});
const token = jwt.sign({ userId: 3, role: 'STUDENT' }, config.jwt.secret, { expiresIn: '5m' });
const cookie = `assistlink_session=${token}`;
after(() => new Promise<void>(resolve => server.close(() => resolve())));

const originalFindUser = prisma.user.findUnique;
beforeEach(() => {
  prisma.user.findUnique = (async args => ({
    id: args.where.id, name: 'Test user', email: 'test@example.test',
    role: args.where.id === 1 ? 'PROFESSOR' : 'STUDENT',
  })) as typeof originalFindUser;
});
afterEach(() => { prisma.user.findUnique = originalFindUser; });

test('serves the web UI and assets without authentication, preserves API 404s', async () => {
  const response = await fetch(`${base}/assistlink/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(await response.text(), /<title>AssistLink/);
  for (const asset of ['app.js', 'styles.css']) assert.equal((await fetch(`${base}/assistlink/${asset}`)).status, 200);
  const missing = await fetch(`${base}/assistlink/api/missing`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).success, false);
});

test('deep web pages require a session and preserve the requested destination', async () => {
  for (const page of ['/assistlink/opportunities/', '/assistlink/opportunities/42/', '/assistlink/profile/', '/assistlink/applications/', '/assistlink/manage/', '/assistlink/users/']) {
    const signedOut = await fetch(`${base}${page}`, { redirect: 'manual' });
    assert.equal(signedOut.status, 302);
    assert.equal(signedOut.headers.get('location'), `/assistlink/login/?next=${encodeURIComponent(page)}`);
    const signedIn = await fetch(`${base}${page}`, { headers: { cookie } });
    assert.equal(signedIn.status, 200);
    assert.match(await signedIn.text(), /<title>AssistLink/);
  }
  assert.equal((await fetch(`${base}/assistlink/login/`)).status, 200);
  assert.equal((await fetch(`${base}/assistlink/api/missing`)).status, 404);
});

test('supports cookies and bearer tokens, rejects expired sessions', async () => {
  for (const headers of [{ cookie }, { authorization: `Bearer ${token}` }]) {
    const response = await fetch(`${base}/assistlink/api/auth/me`, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.userId, 3);
  }
  const expired = jwt.sign({ userId: 3, role: 'STUDENT' }, config.jwt.secret, { expiresIn: -1 });
  assert.equal((await fetch(`${base}/assistlink/api/auth/me`, { headers: { cookie: `assistlink_session=${expired}` } })).status, 401);
});

test('every protected API route rejects anonymous requests', async () => {
  const routes: Array<[string, string]> = [
    ['GET', '/auth/me'], ['GET', '/posts'], ['GET', '/posts/workspace'],
    ['GET', '/posts/1'], ['POST', '/posts'], ['PATCH', '/posts/1'],
    ['PATCH', '/posts/1/close'], ['POST', '/posts/1/rank'],
    ['POST', '/posts/1/applications'], ['GET', '/posts/1/applications'],
    ['GET', '/posts/1/applications/1/resume'], ['PATCH', '/applications/1'],
    ['GET', '/me/profile'], ['PUT', '/me/profile'], ['GET', '/me/applications'],
    ['GET', '/me/resume'], ['POST', '/me/resume'], ['DELETE', '/me/resume'],
    ['GET', '/users'], ['PATCH', '/users/1/role'],
  ];
  for (const [method, route] of routes) {
    const response = await fetch(`${base}/assistlink/api${route}`, { method });
    assert.equal(response.status, 401, `${method} ${route}`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('role restricted APIs reject the wrong signed-in role', async () => {
  const professor = jwt.sign({ userId: 1, role: 'PROFESSOR' }, config.jwt.secret, { expiresIn: '5m' });
  const cases: Array<[string, string, string]> = [
    ['GET', '/users', cookie], ['PATCH', '/users/1/role', cookie],
    ['GET', '/posts/workspace', cookie], ['POST', '/posts', cookie],
    ['PATCH', '/posts/1', cookie], ['PATCH', '/posts/1/close', cookie],
    ['POST', '/posts/1/rank', cookie], ['GET', '/posts/1/applications', cookie],
    ['GET', '/posts/1/applications/1/resume', cookie], ['PATCH', '/applications/1', cookie],
    ['GET', '/me/profile', `assistlink_session=${professor}`],
    ['PUT', '/me/profile', `assistlink_session=${professor}`],
    ['GET', '/me/applications', `assistlink_session=${professor}`],
    ['GET', '/me/resume', `assistlink_session=${professor}`],
    ['POST', '/me/resume', `assistlink_session=${professor}`],
    ['DELETE', '/me/resume', `assistlink_session=${professor}`],
    ['POST', '/posts/1/applications', `assistlink_session=${professor}`],
  ];
  for (const [method, route, cookieHeader] of cases) {
    const response = await fetch(`${base}/assistlink/api${route}`, { method, headers: { cookie: cookieHeader, 'x-assistlink-request': 'web' } });
    assert.equal(response.status, 403, `${method} ${route}`);
  }
});

test('oversized database IDs are rejected before any lookup', async () => {
  assert.equal((await fetch(`${base}/assistlink/api/posts/2147483648`, { headers: { cookie } })).status, 400);
  assert.equal((await fetch(`${base}/assistlink/api/posts/2147483648/applications`, {
    method: 'POST', headers: { cookie, 'x-assistlink-request': 'web' },
  })).status, 400);
});

test('unauthenticated writes keep the existing 401 contract', async () => {
  const response = await fetch(`${base}/assistlink/api/posts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 401);
});

test('cookie-authenticated writes require the browser request header', async () => {
  const response = await fetch(`${base}/assistlink/api/me/profile`, {
    method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ bio: 'test' }),
  });
  assert.equal(response.status, 403);
  const malformedAuth = await fetch(`${base}/assistlink/api/me/profile`, {
    method: 'PUT', headers: { cookie, authorization: 'Basic ignored', 'content-type': 'application/json' }, body: JSON.stringify({ bio: 'test' }),
  });
  assert.equal(malformedAuth.status, 401);
  const logout = await fetch(`${base}/assistlink/api/auth/logout`, { method: 'POST', headers: { cookie, 'x-assistlink-request': 'web' } });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie')!, /assistlink_session=;/);
  assert.match(logout.headers.get('set-cookie')!, /HttpOnly/);
});

test('rejects OAuth callbacks without matching state before exchanging a code', async () => {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...values: unknown[]) => { logs.push(values.map(String).join(' ')); };
  try {
    const response = await fetch(`${base}/assistlink/api/auth/callback?code=secret-authorization-code&state=invalid`);
    assert.equal(response.status, 401);
  } finally { console.log = originalLog; }
  assert.ok(logs.some(line => line.includes('/assistlink/api/auth/callback')));
  assert.ok(logs.every(line => !line.includes('secret-authorization-code')));
});

test('application history is restricted to the current student', async () => {
  const original = prisma.application.findMany;
  let query: unknown;
  prisma.application.findMany = (async args => { query = args; return []; }) as typeof original;
  try {
    const response = await fetch(`${base}/assistlink/api/me/applications`, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.deepEqual((query as { where: unknown }).where, { student: { userId: 3 } });
    const staff = jwt.sign({ userId: 1, role: 'PROFESSOR' }, config.jwt.secret);
    assert.equal((await fetch(`${base}/assistlink/api/me/applications`, { headers: { authorization: `Bearer ${staff}` } })).status, 403);
  } finally { prisma.application.findMany = original; }
});

test('mine filter scopes posts to the actor and retains private/closed posts', async () => {
  const original = prisma.post.findMany;
  let query: unknown;
  prisma.post.findMany = (async args => { query = args; return []; }) as typeof original;
  try {
    const staff = jwt.sign({ userId: 1, role: 'PROFESSOR' }, config.jwt.secret);
    const headers = { authorization: `Bearer ${staff}` };
    await fetch(`${base}/assistlink/api/posts?mine=1`, { headers });
    assert.deepEqual((query as { where: unknown }).where, { authorId: 1 });
    await fetch(`${base}/assistlink/api/posts`, { headers });
    assert.deepEqual((query as { where: unknown }).where, { status: 'OPEN', private: false });
  } finally { prisma.post.findMany = original; }
});

test('private post details stay hidden from unrelated authenticated users', async () => {
  const original = prisma.post.findUnique;
  const originalApplications = prisma.application.findFirst;
  prisma.post.findUnique = (async () => ({ id: 7, authorId: 1, private: true, status: 'OPEN', title: 'Private role' })) as typeof original;
  prisma.application.findFirst = (async () => null) as typeof originalApplications;
  try {
    const student = await fetch(`${base}/assistlink/api/posts/7`, { headers: { cookie } });
    assert.equal(student.status, 404);
    const owner = jwt.sign({ userId: 1, role: 'PROFESSOR' }, config.jwt.secret);
    const response = await fetch(`${base}/assistlink/api/posts/7`, { headers: { authorization: `Bearer ${owner}` } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.title, 'Private role');
  } finally {
    prisma.post.findUnique = original;
    prisma.application.findFirst = originalApplications;
  }
});

test('professor dashboard is staff-only, scoped to its author, and prioritizes pending applications', async () => {
  const original = prisma.post.findMany;
  let query: any;
  prisma.post.findMany = (async args => {
    query = args;
    return [
      { id: 1, title: 'No pending work', applications: [{ status: 'ACCEPTED' }] },
      { id: 2, title: 'Needs review', applications: [{ status: 'PENDING' }, { status: 'REJECTED' }, { status: 'PENDING' }] },
    ];
  }) as typeof original;
  try {
    assert.equal((await fetch(`${base}/assistlink/api/posts/workspace`)).status, 401);
    assert.equal((await fetch(`${base}/assistlink/api/posts/workspace`, { headers: { cookie } })).status, 403);
    const staff = jwt.sign({ userId: 1, role: 'PROFESSOR' }, config.jwt.secret);
    const response = await fetch(`${base}/assistlink/api/posts/workspace`, { headers: { authorization: `Bearer ${staff}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(query.where, { authorId: 1 });
    const data = (await response.json()).data;
    assert.deepEqual(data.map((p: any) => p.id), [2, 1]);
    assert.deepEqual(data[0].applicationCounts, { total: 3, pending: 2, accepted: 0, rejected: 1 });
    assert.equal(data[0].applications, undefined);
  } finally { prisma.post.findMany = original; }
});
