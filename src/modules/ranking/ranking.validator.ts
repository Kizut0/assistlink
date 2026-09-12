import { z } from 'zod';

export const rankingResultSchema = z.object({
  applicationId: z.number().int().positive(),
  score: z.number().int().min(0).max(100),
  rationale: z.string().trim().min(1).max(500),
}).strict();

export const rankingResponseSchema = z.object({ rankings: z.array(rankingResultSchema) }).strict();
export type RankingResult = z.infer<typeof rankingResultSchema>;
