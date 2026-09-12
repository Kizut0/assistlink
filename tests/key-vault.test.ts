import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadSecretsFromKeyVault,
  type KeyVaultClient,
} from '../src/config/keyVault.js';

test('development keeps using local environment values when no vault is configured', async () => {
  const source = { NODE_ENV: 'development', DATABASE_URL: 'local' };
  let created = false;
  const loaded = await loadSecretsFromKeyVault(source, () => {
    created = true;
    throw new Error('must not create a client');
  });
  assert.deepEqual(loaded, []);
  assert.equal(created, false);
  assert.equal(source.DATABASE_URL, 'local');
});

test('production requires a Key Vault URL before application modules load', async () => {
  await assert.rejects(
    loadSecretsFromKeyVault({ NODE_ENV: 'production' }),
    /Missing required production setting: AZURE_KEY_VAULT_URL/,
  );
});

test('loads required and optional secrets from Key Vault without logging values', async () => {
  const source: Record<string, string | undefined> = {
    NODE_ENV: 'production',
    AZURE_KEY_VAULT_URL: 'https://assistlink-test.vault.azure.net/',
  };
  const secrets: Record<string, string> = {
    'DATABASE-URL': 'postgresql://vault',
    'JWT-SECRET': 'vault-jwt',
    'AD-CLIENT-SECRET': 'vault-ad',
    'GEMINI-API-KEY': 'vault-gemini',
  };
  let clientUrl = '';
  const client: KeyVaultClient = { getSecret: async name => ({ value: secrets[name] }) };

  const loaded = await loadSecretsFromKeyVault(source, url => {
    clientUrl = url;
    return client;
  });

  assert.equal(clientUrl, 'https://assistlink-test.vault.azure.net');
  assert.deepEqual(new Set(loaded), new Set(['DATABASE_URL', 'JWT_SECRET', 'AD_CLIENT_SECRET', 'GEMINI_API_KEY']));
  assert.equal(source.DATABASE_URL, 'postgresql://vault');
  assert.equal(source.JWT_SECRET, 'vault-jwt');
  assert.equal(source.AD_CLIENT_SECRET, 'vault-ad');
  assert.equal(source.GEMINI_API_KEY, 'vault-gemini');
});

test('fails startup when a required vault secret is missing', async () => {
  const client: KeyVaultClient = {
    getSecret: async name => ({ value: name === 'JWT-SECRET' ? undefined : 'present' }),
  };
  await assert.rejects(
    loadSecretsFromKeyVault({
      NODE_ENV: 'production',
      AZURE_KEY_VAULT_URL: 'https://assistlink-test.vault.azure.net',
    }, () => client),
    /Key Vault secret has no value: JWT-SECRET/,
  );
});

test('an unavailable optional Gemini secret does not block startup', async () => {
  const source: Record<string, string | undefined> = {
    NODE_ENV: 'production',
    AZURE_KEY_VAULT_URL: 'https://assistlink-test.vault.azure.net',
  };
  const client: KeyVaultClient = {
    getSecret: async name => {
      if (name === 'GEMINI-API-KEY') throw new Error('not found');
      return { value: `value-for-${name}` };
    },
  };
  const loaded = await loadSecretsFromKeyVault(source, () => client);
  assert.deepEqual(new Set(loaded), new Set(['DATABASE_URL', 'JWT_SECRET', 'AD_CLIENT_SECRET']));
  assert.equal(source.GEMINI_API_KEY, undefined);
});

test('rejects non-HTTPS vault URLs before creating a client', async () => {
  await assert.rejects(
    loadSecretsFromKeyVault({
      NODE_ENV: 'production',
      AZURE_KEY_VAULT_URL: 'http://assistlink-test.vault.azure.net',
    }),
    /valid HTTPS URL/,
  );
});
