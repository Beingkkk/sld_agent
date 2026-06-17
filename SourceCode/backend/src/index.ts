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

  // Determine data path relative to this file
  const dataPath = resolve(__dirname, '../../data');

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
