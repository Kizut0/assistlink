import { z } from 'zod';

export const demoLoginSchema = z.object({
  email: z.string().trim().email().max(320),
  passcode: z.string().min(1).max(256),
}).strict();

export type DemoLoginInput = z.infer<typeof demoLoginSchema>;
