import { fileURLToPath } from 'node:url';
import { createServer } from './server.js';

async function main() {
  const port = Number(process.env.SLD_PORT || 0);
  const knowledgeDir = process.env.SLD_KNOWLEDGE_DIR || fileURLToPath(new URL('../knowledge', import.meta.url));
  const staticSchemaDir = process.env.SLD_SCHEMA_DIR || undefined;

  const server = createServer({ port, knowledgeDir, staticSchemaDir });
  const { url, port: actualPort } = await server.start();

  // READY protocol for Electron main process
  console.log(`READY ${url}`);

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });

  return { url, port: actualPort };
}

main().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
