import { z } from 'zod';

// Task 25 — a decision is ACCEPTED or REJECTED. PENDING is the initial state
// an application is created in, not something a professor sets, so it is not
// an accepted value here.
export const decideApplicationSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
});

export type DecideApplicationInput = z.infer<typeof decideApplicationSchema>;
