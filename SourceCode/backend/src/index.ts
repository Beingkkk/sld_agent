import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, resolveApiKey } from './config.js';
import { AgentServer } from './server.js';
import { KnowledgeBase } from './knowledge-base.js';
import { AnthropicClient } from './llm/anthropic.js';
import { MockLLMClient } from './llm/mock.js';
import type { LLMClient } from './llm/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  const config = loadConfig();

  // Determine data path: allow Electron main process to override, otherwise fall
  // back to development layout and then to Electron packaged resources.
  const dataPath =
    process.env.SLDAGENT_DATA_PATH ||
    resolve(__dirname, '../../data');

  console.log(`[Main] Data path: ${dataPath}`);

  const knowledgeBase = new KnowledgeBase(dataPath);
  await knowledgeBase.load();
  console.log('[Main] KnowledgeBase loaded successfully');

  // Determine LLM client: use real client if API key is available, otherwise fallback to mock
  let llmClient: LLMClient;
  const apiKey = resolveApiKey(config);

  if (apiKey && apiKey.trim().length > 0) {
    llmClient = new AnthropicClient({
      apiKey,
      baseUrl: config.llm.baseUrl,
      model: config.llm.model,
      maxTokens: config.llm.maxTokens,
    });
    console.log(`[Main] Using AnthropicClient (model: ${config.llm.model})`);
  } else {
    llmClient = new MockLLMClient();
    console.log('[Main] API Key not configured, using MockLLMClient (degraded mode)');
  }

  const server = new AgentServer({
    config,
    llmClient,
    knowledgeBase,
  });

  await server.start();

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log('\n[Main] Shutting down...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Main] Fatal error:', err);
  process.exit(1);
});
