import 'dotenv/config';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { loadSecretsFromKeyVault } from '../config/keyVault.js';

async function run(): Promise<void> {
  await loadSecretsFromKeyVault();
  const executable = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
  );
  const child = spawn(executable, ['migrate', 'deploy'], {
    env: process.env,
    stdio: 'inherit',
  });
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (code !== 0) throw new Error(`Prisma migration failed with exit code ${code ?? 'unknown'}`);
}

void run().catch((error: unknown) => {
  console.error('Production migration failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
