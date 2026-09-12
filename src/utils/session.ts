import type { Request } from 'express';
import { config } from '../config/index.js';

export const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax' as const,
  path: '/assistlink',
};

export function readCookie(req: Request, name: string): string | undefined {
  const value = req.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  try { return value ? decodeURIComponent(value) : undefined; } catch { return undefined; }
}
