import 'dotenv/config';

// Required service secrets the app must never boot without. AI ranking provider
// keys are optional during local development so ranking can be enabled later.
// AD_CLIENT_ID / AD_TENANT_ID are deliberately NOT here: a client id and tenant id
// are public AD identifiers, not service secrets.
export const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'AD_CLIENT_SECRET',
] as const;

type RequiredKey = (typeof REQUIRED)[number];
type Secrets = Record<RequiredKey, string>;
type Source = Record<string, string | undefined>;

// Fail fast after server bootstrap has optionally populated process.env from
// Key Vault, so missing secrets stop startup rather than failing mid-request.
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
  const env = source.NODE_ENV ?? 'development';
  const demoAuthEnabled = ['1', 'true'].includes((source.DEMO_AUTH_ENABLED ?? '').trim().toLowerCase());
  const demoAuthPasscode = source.DEMO_AUTH_PASSCODE?.trim();
  if (demoAuthEnabled && !demoAuthPasscode) {
    throw new Error('Missing required secret when demo authentication is enabled: DEMO_AUTH_PASSCODE');
  }
  if (demoAuthEnabled && demoAuthPasscode!.length < 12) {
    throw new Error('DEMO_AUTH_PASSCODE must contain at least 12 characters');
  }
  return {
    env,
    isProduction: env === 'production',
    port: Number(process.env.PORT ?? 8081),
    apiBasePath: process.env.API_BASE_PATH ?? '/assistlink/api',

    // Back-compat alias used by lib/prisma.ts.
    databaseUrl: secrets.DATABASE_URL,

    // Required service secrets.
    ...secrets,

    // Ranking providers remain optional so the rest of the API can boot before
    // a provider key is provisioned. Production selects OpenRouter explicitly.
    RANKING_PROVIDER: (source.RANKING_PROVIDER ?? 'gemini').trim().toLowerCase(),
    OPENROUTER_API_KEY: source.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: source.OPENROUTER_MODEL ?? 'openai/gpt-oss-20b:free',
    OPENROUTER_BASE_URL:
      source.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    GEMINI_API_KEY: source.GEMINI_API_KEY,
    GEMINI_MODEL: source.GEMINI_MODEL ?? 'gemini-3.6-flash',
    GEMINI_BASE_URL:
      source.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',

    demoAuth: {
      enabled: demoAuthEnabled,
      passcode: demoAuthPasscode,
    },

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
