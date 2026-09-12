import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { config } from '../src/config/index.js';
import { assignRole, listUsers } from '../src/modules/users/users.service.js';

// Opt-in: exercises PostgreSQL isolation and cleans up only this run's fixtures.
test('database: pagination, persistent assignments, session refresh, and concurrent admin demotions', {
  skip: process.env.RUN_DATABASE_TESTS !== '1',
}, async () => {
  const prefix = `role-test-${randomUUID()}`;
  const ids: number[] = [];
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/assistlink/api`;
  try {
    for (let i = 0; i < 27; i++) {
      const user = await prisma.user.create({ data: {
        adObjectId: `${prefix}-${i}`, email: `${prefix}-${i}@example.test`, name: `${prefix} Person ${i}`,
        role: i < 2 ? 'ADMIN' : 'STUDENT',
      } });
      ids.push(user.id);
    }
    const first = await listUsers({ q: prefix.toUpperCase(), page: 1 });
    const second = await listUsers({ q: prefix, page: 2 });
    assert.equal(first.users.length, 25);
    assert.equal(second.users.length, 2);
    assert.equal(first.pagination.total, 27);
    assert.equal(new Set([...first.users, ...second.users].map(u => u.id)).size, 27);
    assert.equal((await listUsers({ q: prefix, role: 'ADMIN', page: 1 })).pagination.total, 2);
    assert.equal((await listUsers({ q: `${prefix}-26@example.test`, page: 1 })).pagination.total, 1);
    assert.equal((await listUsers({ q: prefix, page: 999 })).pagination.page, 2);
    assert.equal((await listUsers({ q: `${prefix}-missing`, page: 1 })).users.length, 0);

    const studentToken = jwt.sign({ userId: ids[2], role: 'STUDENT' }, config.jwt.secret, { expiresIn: '5m' });
    const adminToken = jwt.sign({ userId: ids[0], role: 'ADMIN' }, config.jwt.secret, { expiresIn: '5m' });
    const studentProfile = await prisma.student.create({ data: { userId: ids[2], skills: ['TypeScript'] } });
    const post = await prisma.post.create({ data: { title: 'Fixture opportunity', details: 'Test', jobCategory: 'RA', authorId: ids[2], requiredSkills: [] } });
    const application = await prisma.application.create({ data: { studentId: studentProfile.id, postId: post.id } });
    try {
      const change = await fetch(`${base}/users/${ids[2]}/role`, {
        method: 'PATCH', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ role: 'PROFESSOR' }),
      });
      assert.equal(change.status, 200);
      const me = await fetch(`${base}/auth/me`, { headers: { cookie: `assistlink_session=${studentToken}` } });
      assert.equal((await me.json()).data.role, 'PROFESSOR');
      assert.ok(await prisma.student.findUnique({ where: { id: studentProfile.id } }));
      assert.ok(await prisma.post.findUnique({ where: { id: post.id } }));
      assert.ok(await prisma.application.findUnique({ where: { id: application.id } }));
    } finally {
      await prisma.application.deleteMany({ where: { id: application.id } });
      await prisma.post.deleteMany({ where: { id: post.id } });
      await prisma.student.deleteMany({ where: { id: studentProfile.id } });
    }

    const results = await Promise.allSettled([
      assignRole(ids[1], { role: 'STUDENT' }, { userId: ids[0], role: 'ADMIN' }),
      assignRole(ids[0], { role: 'STUDENT' }, { userId: ids[1], role: 'ADMIN' }),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
    assert.equal(await prisma.user.count({ where: { id: { in: ids.slice(0, 2) }, role: 'ADMIN' } }), 1);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
