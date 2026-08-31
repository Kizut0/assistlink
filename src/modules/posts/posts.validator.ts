import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  requiredSkills: z.array(z.string()).default([]),
});

export const updatePostSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).optional(),
    requiredSkills: z.array(z.string()).optional(),
    status: z.enum(['OPEN', 'CLOSED']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
