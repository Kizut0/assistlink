import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthUser } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';
import type { AssignRoleInput, ListUsersInput } from './users.validator.js';

const userSelect = { id: true, name: true, email: true, role: true, createdAt: true } as const;
const pageSize = 25;

export function listUsers(input: ListUsersInput) {
  const where: Prisma.UserWhereInput = {
    ...(input.role ? { role: input.role } : {}),
    ...(input.q ? { OR: [
      { name: { contains: input.q, mode: 'insensitive' } },
      { email: { contains: input.q, mode: 'insensitive' } },
    ] } : {}),
  };
  return prisma.$transaction(async tx => {
    const total = await tx.user.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(input.page, totalPages);
    const users = await tx.user.findMany({
      where, select: userSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize, take: pageSize,
    });
    return { users, pagination: { page, pageSize, total, totalPages } };
  }, { isolationLevel: 'RepeatableRead' });
}

export async function assignRole(id: number, input: AssignRoleInput, actor: AuthUser) {
  // Serializable retries re-check the actor and the admin count after conflicting
  // role changes. Two admins cannot concurrently demote one another successfully.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const requester = await tx.user.findUnique({ where: { id: actor.userId }, select: userSelect });
        if (!requester || (!actor.devImpersonation && requester.role !== 'ADMIN') || actor.role !== 'ADMIN') {
          throw ApiError.forbidden('Only current admins can assign roles');
        }
        if (id === actor.userId) throw ApiError.forbidden('You cannot change your own role');
        const user = await tx.user.findUnique({ where: { id }, select: userSelect });
        if (!user) throw ApiError.notFound('User not found');
        if (user.role === input.role) return user;
        if (user.role === 'ADMIN' && input.role !== 'ADMIN') {
          const admins = await tx.user.count({ where: { role: 'ADMIN' } });
          if (admins <= 1) throw ApiError.conflict('At least one admin must remain');
        }
        return tx.user.update({ where: { id }, data: { role: input.role }, select: userSelect });
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2034') throw error;
      if (attempt === 2) throw ApiError.conflict('Roles changed concurrently. Refresh the user list and try again.');
    }
  }
  throw ApiError.conflict('Please try the role change again');
}
