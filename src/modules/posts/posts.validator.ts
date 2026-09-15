import { z } from 'zod';

export const JOB_CATEGORIES = [
  'RA',
  'TA',
  'INTERNSHIP',
  'PROJECT_ASSISTANT',
  'LAB_ASSISTANT',
  'PEER_TUTOR',
] as const;

// Task 19 — the create contract from the handbook.
export const createPostSchema = z.object({
  title: z.string().min(3).max(200),
  details: z.string().min(1),
  requiredSkills: z.array(z.string()).default([]),
  jobCategory: z.enum(JOB_CATEGORIES),
  private: z.boolean().default(false),
});

// Task 20 — partial update; at least one field must be present.
export const updatePostSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    details: z.string().min(1).optional(),
    requiredSkills: z.array(z.string()).optional(),
    jobCategory: z.enum(JOB_CATEGORIES).optional(),
    private: z.boolean().optional(),
    status: z.enum(['OPEN', 'CLOSED']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
