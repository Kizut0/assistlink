import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 8081),
  databaseUrl: required('DATABASE_URL'),
  // Added in later phases: jwtSecret, azure*, openaiApiKey, partnerApiKey.
} as const;
