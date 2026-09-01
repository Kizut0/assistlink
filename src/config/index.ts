import 'dotenv/config';

// Handbook Task 05 — the five vault-backed secrets the app must never boot without.
// AD_CLIENT_ID / AD_TENANT_ID are deliberately NOT here: a client id and tenant id
// are public AD identifiers, not Key Vault secrets (Task 05 redline). If they were
// required, Task 38 would build its source from the five-entry vault map and the app
// would die at boot with "Missing required secret: AD_CLIENT_ID".
export const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'OPENAI_API_KEY',
  'PARTNER_API_KEY',
  'AD_CLIENT_SECRET',
] as const;

type RequiredKey = (typeof REQUIRED)[number];
type Secrets = Record<RequiredKey, string>;
type Source = Record<string, string | undefined>;

// Fail fast: throw on the first missing secret so the app dies at boot, never
// mid-request. `source` is the seam Phase 07 / Task 38 swaps for the Key Vault map.
export function loadConfig(source: Source): Secrets {
  const cfg = {} as Secrets;
  for (const key of REQUIRED) {
    const value = source[key];
    if (!value) throw new Error(`Missing required secret: ${key}`);
    cfg[key] = value;
  }
  return cfg;
}

export function buildConfig(source: Source = process.env) {
  const secrets = loadConfig(source);
  const env = process.env.NODE_ENV ?? 'development';
  return {
    env,
    isProduction: env === 'production',
    port: Number(process.env.PORT ?? 8081),
    apiBasePath: process.env.API_BASE_PATH ?? '/assistlink/api',

    // Back-compat alias used by lib/prisma.ts.
    databaseUrl: secrets.DATABASE_URL,

    // The five required secrets.
    ...secrets,

    // Public AD identifiers — loaded from env in every environment (Task 05 redline).
    AD_CLIENT_ID: process.env.AD_CLIENT_ID,
    AD_TENANT_ID: process.env.AD_TENANT_ID,
    AD_REDIRECT_URI:
      process.env.AD_REDIRECT_URI ??
      'http://localhost:8081/assistlink/api/auth/callback',

    // Handbook Task 14: short-lived session JWTs — 30 minutes.
    jwt: {
      secret: secrets.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN ?? '30m',
    },
  };
}

export const config = buildConfig();
