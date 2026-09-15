import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

type Environment = Record<string, string | undefined>;

export interface KeyVaultClient {
  getSecret(name: string): Promise<{ value?: string }>;
}

export type KeyVaultClientFactory = (vaultUrl: string) => KeyVaultClient;

export const REQUIRED_KEY_VAULT_SECRETS = {
  DATABASE_URL: 'DATABASE-URL',
  JWT_SECRET: 'JWT-SECRET',
  AD_CLIENT_SECRET: 'AD-CLIENT-SECRET',
} as const;

export const OPTIONAL_KEY_VAULT_SECRETS = {
  OPENROUTER_API_KEY: 'OPENROUTER-API-KEY',
  GEMINI_API_KEY: 'GEMINI-API-KEY',
  DEMO_AUTH_PASSCODE: 'DEMO-AUTH-PASSCODE',
} as const;

function createClient(vaultUrl: string): KeyVaultClient {
  return new SecretClient(vaultUrl, new DefaultAzureCredential());
}

function validateVaultUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('AZURE_KEY_VAULT_URL must be a valid HTTPS URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('AZURE_KEY_VAULT_URL must be a valid HTTPS URL');
  }
  return url.toString().replace(/\/$/, '');
}

async function readRequiredSecrets(client: KeyVaultClient) {
  return Promise.all(Object.entries(REQUIRED_KEY_VAULT_SECRETS).map(async ([environmentName, vaultName]) => {
    let value: string | undefined;
    try {
      value = (await client.getSecret(vaultName)).value?.trim();
    } catch (cause) {
      throw new Error(`Failed to load required Key Vault secret: ${vaultName}`, { cause });
    }
    if (!value) throw new Error(`Key Vault secret has no value: ${vaultName}`);
    return [environmentName, value] as const;
  }));
}

async function readOptionalSecrets(client: KeyVaultClient) {
  const loaded: Array<readonly [string, string]> = [];
  for (const [environmentName, vaultName] of Object.entries(OPTIONAL_KEY_VAULT_SECRETS)) {
    try {
      const value = (await client.getSecret(vaultName)).value?.trim();
      if (value) loaded.push([environmentName, value]);
    } catch {
      // Optional features validate their own requirements after the required
      // service secrets have loaded successfully.
    }
  }
  return loaded;
}

/**
 * Populate runtime secret environment variables before importing app modules.
 * Development keeps using .env unless a vault URL is explicitly supplied.
 */
export async function loadSecretsFromKeyVault(
  source: Environment = process.env,
  makeClient: KeyVaultClientFactory = createClient,
): Promise<string[]> {
  const rawVaultUrl = source.AZURE_KEY_VAULT_URL?.trim();
  if (!rawVaultUrl) {
    if (source.NODE_ENV === 'production') {
      throw new Error('Missing required production setting: AZURE_KEY_VAULT_URL');
    }
    return [];
  }

  const client = makeClient(validateVaultUrl(rawVaultUrl));
  const values = [
    ...await readRequiredSecrets(client),
    ...await readOptionalSecrets(client),
  ];
  for (const [name, value] of values) source[name] = value;
  return values.map(([name]) => name);
}
