import { after, before, beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { config } from '../src/config/index.js';
import { prisma } from '../src/lib/prisma.js';
import { assignRole } from '../src/modules/users/users.service.js';
import { getMsal } from '../src/modules/auth/auth.service.js';

type User = { id: number; name: string; email: string; role: 'ADMIN' | 'PROFESSOR' | 'STUDENT'; createdAt: Date };
let users: User[];
let transactionOptions: unknown;
let serializationFailures = 0;
const originals = { findUnique: prisma.user.findUnique, transaction: prisma.$transaction, upsert: prisma.user.upsert };
const server = app.listen(0, '127.0.0.1');
let base: string;
before(async () => {
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/assistlink/api`;
});
after(() => new Promise<void>(resolve => server.close(() => resolve())));
beforeEach(() => {
  users = ['ADMIN','PROFESSOR','STUDENT','ADMIN'].map((role, index) => ({ id: index + 1, name: `Person ${index + 1}`, email: `${index + 1}@example.test`, role: role as User['role'], createdAt: new Date() }));
  serializationFailures = 0;
  prisma.user.findUnique = (async args => users.find(u => u.id === args.where.id) ?? null) as typeof originals.findUnique;
  prisma.$transaction = (async (callback: Function, options: unknown) => {
    transactionOptions = options;
    if (serializationFailures-- > 0) throw { code: 'P2034' };
    return callback({ user: {
      findUnique: prisma.user.findUnique,
      count: async ({ where }: { where: { role?: string } }) => users.filter(u => !where.role || u.role === where.role).length,
      findMany: async () => users,
      update: async ({ where, data }: { where: { id: number }; data: { role: User['role'] } }) => {
        const user = users.find(u => u.id === where.id)!; user.role = data.role; return user;
      },
    } });
  }) as typeof originals.transaction;
});
afterEach(() => { prisma.user.findUnique = originals.findUnique; prisma.$transaction = originals.transaction; prisma.user.upsert = originals.upsert; });
function headers(id: number, role = 'STUDENT') {
  return { authorization: `Bearer ${jwt.sign({ userId: id, role }, config.jwt.secret, { expiresIn: '5m' })}`, 'content-type': 'application/json' };
}
async function change(id: number, role: string, actor = 1) {
  return fetch(`${base}/users/${id}/role`, { method: 'PATCH', headers: headers(actor), body: JSON.stringify({ role }) });
}

test('only current database admins may list and assign roles, regardless of JWT role', async () => {
  assert.equal((await fetch(`${base}/users`)).status, 401);
  for (const id of [2, 3]) {
    assert.equal((await fetch(`${base}/users`, { headers: headers(id, 'ADMIN') })).status, 403);
    assert.equal((await change(4, 'STUDENT', id)).status, 403);
  }
  const response = await fetch(`${base}/users`, { headers: headers(1, 'STUDENT') });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.pagination, { page: 1, pageSize: 25, total: 4, totalPages: 1 });
});

test('validates roles, query strings, IDs, unknown users and self changes', async () => {
  for (const query of ['page=0','page=-1','page=1.5','page=abc','page=9007199254740992','role=OWNER','q=a&q=b']) {
    assert.equal((await fetch(`${base}/users?${query}`, { headers: headers(1) })).status, 400, query);
  }
  assert.equal((await change(3,'OWNER')).status, 400);
  assert.equal((await change(0,'ADMIN')).status, 400);
  assert.equal((await change(999,'ADMIN')).status, 404);
  assert.equal((await change(1,'STUDENT')).status, 403);
  assert.equal((await change(1,'ADMIN')).status, 403);
});

test('assigns all roles and existing cookie/bearer sessions immediately use the saved role', async () => {
  const oldHeaders = headers(3, 'STUDENT');
  for (const role of ['PROFESSOR','ADMIN','STUDENT']) {
    const response = await change(3, role);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.role, role);
    for (const requestHeaders of [oldHeaders, { cookie: `assistlink_session=${oldHeaders.authorization.slice(7)}` }]) {
      const me = await fetch(`${base}/auth/me`, { headers: requestHeaders });
      assert.equal((await me.json()).data.role, role);
    }
    assert.equal((await fetch(`${base}/users`, { headers: oldHeaders })).status, role === 'ADMIN' ? 200 : 403);
  }
  users = users.filter(u => u.id !== 3);
  assert.equal((await fetch(`${base}/auth/me`, { headers: oldHeaders })).status, 401);
});

test('transaction rechecks the actor, refuses the last admin, and retries conflicts', async () => {
  await assert.rejects(assignRole(4, { role: 'STUDENT' }, { userId: 3, role: 'ADMIN' }), { statusCode: 403 });
  users[3].role = 'STUDENT';
  await assert.rejects(assignRole(1, { role: 'STUDENT' }, { userId: 3, role: 'ADMIN', devImpersonation: true }), { statusCode: 409 });
  serializationFailures = 2;
  assert.equal((await assignRole(3, { role: 'PROFESSOR' }, { userId: 1, role: 'ADMIN' })).role, 'PROFESSOR');
  assert.deepEqual(transactionOptions, { isolationLevel: 'Serializable' });
  serializationFailures = 3;
  await assert.rejects(assignRole(3, { role: 'ADMIN' }, { userId: 1, role: 'ADMIN' }), { statusCode: 409 });
});

test('development impersonation remains separate from saved roles and production disables it', async () => {
  const response = await fetch(`${base}/auth/me`, { headers: { 'x-dev-user': JSON.stringify({ userId: 3, role: 'ADMIN' }) } });
  assert.equal((await response.json()).data.devImpersonation, true);
  assert.equal(users[2].role, 'STUDENT');
  const original = config.isProduction;
  try {
    config.isProduction = true;
    assert.equal((await fetch(`${base}/users`, { headers: { 'x-dev-user': '{"userId":1,"role":"ADMIN"}' } })).status, 401);
  } finally { config.isProduction = original; }
});

test('Microsoft callback keeps assigned roles and defaults only new accounts to Student', async () => {
  const priorClientId = config.AD_CLIENT_ID;
  const priorTenantId = config.AD_TENANT_ID;
  config.AD_CLIENT_ID = '00000000-0000-0000-0000-000000000001';
  config.AD_TENANT_ID = '00000000-0000-0000-0000-000000000002';
  const msal = getMsal();
  const originalAcquire = msal.acquireTokenByCode;
  const originalUrl = msal.getAuthCodeUrl;
  msal.getAuthCodeUrl = async ({ state }) => `https://login.microsoftonline.com/test?state=${state}`;
  msal.acquireTokenByCode = (async () => ({ account: { homeAccountId: 'test-account', username: 'teacher@example.test', name: 'Teacher' } })) as typeof originalAcquire;
  let existingRole: User['role'] | null = 'PROFESSOR';
  prisma.user.upsert = (async args => {
    assert.equal(args.create.role, 'STUDENT');
    assert.equal('role' in args.update, false);
    return { ...users[1], role: existingRole ?? args.create.role };
  }) as typeof originals.upsert;
  try {
    for (const role of ['PROFESSOR','ADMIN',null] as const) {
      existingRole = role;
      const login = await fetch(`${base}/auth/login`, { redirect: 'manual' });
      const state = new URL(login.headers.get('location')!).searchParams.get('state');
      const response = await fetch(`${base}/auth/callback?code=test&state=${state}`, { headers: { cookie: login.headers.get('set-cookie')!.split(';')[0] } });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.user.role, role ?? 'STUDENT');
    }
  } finally {
    msal.acquireTokenByCode = originalAcquire; msal.getAuthCodeUrl = originalUrl;
    config.AD_CLIENT_ID = priorClientId; config.AD_TENANT_ID = priorTenantId;
  }
});
