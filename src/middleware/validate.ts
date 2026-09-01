import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';

// Task 21 — no write route trusts the raw request body. Parses and REPLACES
// req.body with the validated/coerced result; a ZodError is forwarded to the
// central errorHandler, which renders it as 400 with the issue list.
export function validate(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    return next();
  };
}
