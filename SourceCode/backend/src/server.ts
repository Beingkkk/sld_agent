import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { LLMClient } from './llm/client.js';
import { KnowledgeBase } from './knowledge-base.js';
import { PromptBuilder } from './prompt-builder.js';
import { RuleGenerator } from './rule-generator.js';
import type {
  TreeStateSnapshot,
  RuleNode,
  NodeType,
} from '@sldagent/core';
import { TreePath } from '@sldagent/core';
import type { AppConfig } from './config.js';

export interface AgentServerOptions {
  config: AppConfig;
  llmClient: LLMClient;
  knowledgeBase: KnowledgeBase;
}

export interface AgentMessage {
  type: string;
  id: string;
  payload: Record<string, unknown>;
}

export interface AgentResponse {
  type: string;
  id: string;
  payload: Record<string, unknown>;
}

export class AgentServer {
  private readonly config: AppConfig;
  private readonly llmClient: LLMClient;
  private readonly knowledgeBase: KnowledgeBase;
  private wss: WebSocketServer | null = null;
  private httpServer: Server | null = null;
  private clients = new Map<string, WebSocket>();
  private clientCounter = 0;

  constructor(options: AgentServerOptions) {
    this.config = options.config;
    this.llmClient = options.llmClient;
    this.knowledgeBase = options.knowledgeBase;
  }

  async start(): Promise<void> {
    const { host, port } = this.config.server;

    this.wss = new WebSocketServer({
      host,
      port,
    });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = `client_${++this.clientCounter}`;
      this.clients.set(clientId, ws);

      console.log(`[AgentServer] Client connected: ${clientId}`);

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as AgentMessage;
          const response = await this.handleMessage(clientId, message);
          if (response) {
            ws.send(JSON.stringify(response));
          }
        } catch (err) {
          console.error(`[AgentServer] Error handling message from ${clientId}:`, err);
          const errorResponse: AgentResponse = {
            type: 'error',
            id: 'error',
            payload: {
              message: err instanceof Error ? err.message : 'Unknown error',
            },
          };
          ws.send(JSON.stringify(errorResponse));
        }
      });

      ws.on('close', () => {
        console.log(`[AgentServer] Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (err) => {
        console.error(`[AgentServer] WebSocket error for ${clientId}:`, err);
      });
    });

    this.wss.on('error', (err) => {
      console.error('[AgentServer] Server error:', err);
    });

    console.log(`[AgentServer] WebSocket server listening on ws://${host}:${port}`);
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const [clientId, ws] of this.clients) {
        ws.close();
        this.clients.delete(clientId);
      }

      this.wss?.close(() => {
        console.log('[AgentServer] Server stopped');
        resolve();
      });
    });
  }

  private async handleMessage(
    _clientId: string,
    message: AgentMessage
  ): Promise<AgentResponse | null> {
    switch (message.type) {
      case 'explain_rule':
        return this.handleExplainRule(message);
      case 'explain_property':
        return this.handleExplainProperty(message);
      case 'generate_rules':
        return this.handleGenerateRules(message);
      default:
        return {
          type: 'error',
          id: message.id,
          payload: { message: `Unknown message type: ${message.type}` },
        };
    }
  }

  private async handleExplainRule(message: AgentMessage): Promise<AgentResponse> {
    const treeSnapshot = message.payload.treeSnapshot as TreeStateSnapshot;
    const pathArray = message.payload.path as number[];

    // Navigate to the Rule node using the path
    const path = new TreePath(pathArray);
    let node: unknown = treeSnapshot.root.namedLayer;
    const segments = path.toArray();

    for (let i = 1; i < segments.length; i++) {
      const idx = segments[i];
      if (node && typeof node === 'object' && 'children' in node) {
        const children = (node as Record<string, unknown>).children as unknown[];
        node = children[idx];
      }
    }

    const ruleNode = node as RuleNode;

    const context = {
      treeSnapshot,
      path: pathArray,
      ruleNode,
    };

    const prompt = PromptBuilder.explainRule(context, this.knowledgeBase);
    const text = await this.llmClient.complete(prompt);

    // Also check for warnings
    const warnPrompt = PromptBuilder.warnRule(context, this.knowledgeBase);
    const warningText = await this.llmClient.complete(warnPrompt);

    const warnings: string[] = [];
    if (warningText && !warningText.includes('看起来合理')) {
      warnings.push(warningText);
    }

    // Add programmatic warnings
    if (ruleNode.children.length === 0) {
      warnings.push('该 Rule 未包含任何 Symbolizer，不会渲染任何内容。');
    }
    if (ruleNode.data.elseFilter && ruleNode.data.filter) {
      warnings.push('该 Rule 已开启 elseFilter，Filter 设置将被忽略。');
    }
    const { min, max } = ruleNode.data.scaleDenominator;
    if (min !== null && max !== null && min >= max) {
      warnings.push('比例尺范围无效：最小值必须小于最大值。');
    }

    return {
      type: 'rule_explanation',
      id: message.id,
      payload: {
        text,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  }

  private async handleExplainProperty(message: AgentMessage): Promise<AgentResponse> {
    const nodeType = message.payload.nodeType as NodeType;
    const fieldName = message.payload.fieldName as string;
    const value = message.payload.value;

    const prompt = PromptBuilder.explainProperty(nodeType, fieldName, value, this.knowledgeBase);
    const text = await this.llmClient.complete(prompt);

    return {
      type: 'property_explanation',
      id: message.id,
      payload: { text },
    };
  }

  private async handleGenerateRules(message: AgentMessage): Promise<AgentResponse> {
    const dataSchema = message.payload.dataSchema as {
      features: Array<{ properties: Record<string, unknown> }>;
    };
    const attribute = message.payload.attribute as string;
    const method = message.payload.method as 'equalInterval' | 'quantile' | 'naturalBreaks';
    const classes = message.payload.classes as number;
    const colorRamp = message.payload.colorRamp as string[];

    const rules = RuleGenerator.classify(
      { features: dataSchema.features },
      { attribute, method, classes, colorRamp }
    );

    return {
      type: 'generated_rules',
      id: message.id,
      payload: { rules },
    };
  }
}
