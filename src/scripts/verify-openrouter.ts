import 'dotenv/config';
import { loadSecretsFromKeyVault } from '../config/keyVault.js';

async function verify(): Promise<void> {
  await loadSecretsFromKeyVault();
  const [{ config }, { OpenRouterProviderError, verifyOpenRouterConnection }] = await Promise.all([
    import('../config/index.js'),
    import('../modules/ranking/openrouter.service.js'),
  ]);

  try {
    const result = await verifyOpenRouterConnection();
    console.log(JSON.stringify({ success: true, ...result }, null, 2));
  } catch (error) {
    const diagnostic = error instanceof OpenRouterProviderError
      ? error.diagnostic
      : { model: config.OPENROUTER_MODEL };
    console.error(JSON.stringify({
      success: false,
      ...diagnostic,
      error: error instanceof Error ? error.message : 'OpenRouter verification failed',
    }, null, 2));
    process.exitCode = 1;
  }
}

void verify().catch((error: unknown) => {
  console.error(JSON.stringify({
    success: false,
    error: error instanceof Error ? error.message : 'OpenRouter verification failed',
  }, null, 2));
  process.exitCode = 1;
});
