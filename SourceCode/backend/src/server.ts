import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type { WsServerOptions } from './types.js';
import { createRouter } from './router.js';
import { AgentSession } from './session/AgentSession.js';
import { KnowledgeBaseLoader } from './knowledge/KnowledgeBaseLoader.js';
import { createSldService } from './sld/SldService.js';
import { LlmClient } from './llm/LlmClient.js';
import { loadConfig } from './config.js';

import { PromptBuilder } from './knowledge/PromptBuilder.js';

export function createServer(options: WsServerOptions) {
  const wss = new WebSocketServer({ port: options.port });
  let actualPort = 0;
  const sessions = new WeakMap<WebSocket, AgentSession>();

  const loader = new KnowledgeBaseLoader();
  const promptBuilder = new PromptBuilder();
  const sldService = createSldService({
    xsdPath: options.xsdPath,
    xmllintPath: options.xmllintPath,
    skipXsd: options.skipXsd,
    wasmSchemaBundleDir: options.wasmSchemaBundleDir ?? options.staticSchemaDir,
    useWasm: options.useWasm,
  });
  const config = loadConfig(options.configPath);
  const llmClient = new LlmClient({
    baseUrl: config.llm.base_url,
    apiKey: config.llm.auth_key,
    model: config.llm.model_name,
  });

  const router = createRouter();

  async function ensureSession(ws: WebSocket): Promise<AgentSession> {
    if (!sessions.has(ws)) {
      const knowledgeBase = await loader.load(options.knowledgeDir, 'default');
      const session = new AgentSession({
        id: randomUUID(),
        knowledgeBase,
        promptBuilder,
        sldService,
        llmClient,
      });
      sessions.set(ws, session);
    }
    return sessions.get(ws)!;
  }

  async function handleMessage(raw: string, ws: WebSocket): Promise<void> {
    const response = await router.handle(raw, await ensureSession(ws));
    ws.send(JSON.stringify({ ...response, timestamp: Date.now() }));
  }

  function start(): Promise<{ url: string; port: number }> {
    return new Promise((resolve) => {
      wss.on('connection', (ws) => {
        ws.on('message', async (data) => {
          try {
            await handleMessage(data.toString(), ws);
          } catch (err) {
            ws.send(JSON.stringify({
              type: 'error',
              requestId: 'unknown',
              payload: { code: 'INTERNAL_ERROR', message: String(err) },
              timestamp: Date.now(),
            }));
          }
        });
      });

      wss.on('listening', () => {
        actualPort = (wss.address() as { port: number }).port;
        const url = `ws://localhost:${actualPort}`;
        // REQUIRED by interface-contracts.md §9.1 for Electron startup handshake.
        console.log(`READY ${url}`);
        resolve({ url, port: actualPort });
      });
    });
  }

  async function stop(): Promise<void> {
    return new Promise((resolve) => {
      wss.close(() => resolve());
    });
  }

  return { start, stop };
}
