import { ConfidentialClientApplication } from '@azure/msal-node';
import { config } from '../../config/index.js';
import { ApiError } from '../../utils/ApiError.js';

// Task 12 — MSAL confidential client built from the AD app registration.
// Lazily constructed so the app still boots with placeholder AD ids in dev; a
// login attempt without real credentials returns a clean 401 instead of crashing.
let client: ConfidentialClientApplication | null = null;

export function getMsal(): ConfidentialClientApplication {
  if (!config.AD_CLIENT_ID || !config.AD_TENANT_ID) {
    throw ApiError.unauthorized(
      'Microsoft AD is not configured (set AD_CLIENT_ID / AD_TENANT_ID)',
    );
  }
  if (!client) {
    client = new ConfidentialClientApplication({
      auth: {
        clientId: config.AD_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${config.AD_TENANT_ID}`,
        clientSecret: config.AD_CLIENT_SECRET,
      },
    });
  }
  return client;
}

export const REDIRECT_URI = config.AD_REDIRECT_URI;
export const SCOPES = ['user.read'];
