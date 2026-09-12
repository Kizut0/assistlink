import 'dotenv/config';
import { loadSecretsFromKeyVault } from './config/keyVault.js';

async function start(): Promise<void> {
  await loadSecretsFromKeyVault();
  // These imports must happen after Key Vault has populated process.env because
  // config, Prisma, JWT, and MSAL are constructed during module initialization.
  const [{ default: app }, { config }] = await Promise.all([
    import('./app.js'),
    import('./config/index.js'),
  ]);

  const server = app.listen(config.port, () => {
    console.log(`AssistLink API (${config.env}) listening on :${config.port}`);
  });

  function shutdown(signal: string): void {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

void start().catch((error: unknown) => {
  console.error('AssistLink startup failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
