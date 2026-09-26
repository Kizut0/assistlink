import { z } from 'zod';

export const roleSchema = z.enum(['STUDENT', 'PROFESSOR', 'ADMIN']);
export const assignRoleSchema = z.object({ role: roleSchema }).strict();
export const userIdSchema = z.coerce.number().int().positive().max(2_147_483_647);
export const listUsersSchema = z.object({
  q: z.string().trim().max(200).default(''),
  role: roleSchema.optional(),
  page: z.string().regex(/^[1-9]\d*$/).transform(Number)
    .pipe(z.number().int().max(Number.MAX_SAFE_INTEGER)).default(1),
});

export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
