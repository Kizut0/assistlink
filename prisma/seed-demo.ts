import 'dotenv/config';
import { loadSecretsFromKeyVault } from '../src/config/keyVault.js';

async function run(): Promise<void> {
  await loadSecretsFromKeyVault();
  const { runDemoSeed } = await import('./seed.js');
  await runDemoSeed();
}

void run().catch((error: unknown) => {
  console.error('❌ Demo seed bootstrap failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
