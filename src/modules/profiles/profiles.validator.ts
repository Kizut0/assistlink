import { z } from 'zod';

// editable fields: faculty/major, skills[], resumeText/resumeUrl,
// workHoursPerWeek, gpa, bio
// all optional so partial updates work, but need at least one field set
export const upsertProfileSchema = z
  .object({
    faculty: z.string().trim().min(1).max(200).optional().nullable(),
    major: z.string().trim().min(1).max(200).optional().nullable(),
    skills: z.array(z.string().min(1)).optional(),
    resumeUrl: z.string().url().optional().nullable(),
    resumeText: z.string().max(20000).optional().nullable(),
    workHoursPerWeek: z.number().int().min(0).max(80).optional().nullable(),
    gpa: z.number().min(0).max(4.0).optional().nullable(),
    bio: z.string().max(2000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;
