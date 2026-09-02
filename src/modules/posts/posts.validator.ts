import { z } from 'zod';

// Task 19 — the create contract from the handbook.
export const createPostSchema = z.object({
  title: z.string().min(3).max(200),
  details: z.string().min(1),
  requiredSkills: z.array(z.string()).default([]),
  jobCategory: z.enum(['RA', 'TA']),
  private: z.boolean().default(false),
});

// Task 20 — partial update; at least one field must be present.
export const updatePostSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    details: z.string().min(1).optional(),
    requiredSkills: z.array(z.string()).optional(),
    jobCategory: z.enum(['RA', 'TA']).optional(),
    private: z.boolean().optional(),
    status: z.enum(['OPEN', 'CLOSED']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
