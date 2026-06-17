import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { AgentServer } from '../src/server.js';
import { KnowledgeBase } from '../src/knowledge-base.js';
import { MockLLMClient } from '../src/llm/mock.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { TreeStateSnapshot } from '@sldagent/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_PORT = 18765;
const TEST_HOST = '127.0.0.1';

function createMinimalTreeSnapshot(): TreeStateSnapshot {
  return {
    version: '1.0.0',
    root: {
      version: '1.0.0',
      namedLayer: {
        id: 'nl_1',
        type: 'NamedLayer',
        data: { name: 'test_layer' },
        children: [
          {
            id: 'us_1',
            type: 'UserStyle',
            data: { name: 'test_style', title: '', abstract: '', isDefault: false },
            children: [
              {
                id: 'fts_1',
                type: 'FeatureTypeStyle',
                data: { title: '', abstract: '', featureTypeName: '' },
                children: [
                  {
                    id: 'rule_1',
                    type: 'Rule',
                    data: {
                      name: 'test_rule',
                      title: 'Test Rule',
                      abstract: '',
                      elseFilter: false,
                      scaleDenominator: { min: null, max: null },
                      filter: null,
                    },
                    children: [
                      {
                        id: 'sym_1',
                        type: 'Symbolizer',
                        kind: 'Mark',
                        data: {
                          markWellKnownName: 'circle',
                          markRadius: 12,
                          markFillColor: '#FF0000',
                          markFillOpacity: 1,
                          markStrokeColor: '#000000',
                          markStrokeWidth: 0,
                        },
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    selectedPath: [0, 0, 0, 0],
    expandedPaths: [],
    issues: [],
  };
}

describe('AgentServer WebSocket Integration', () => {
  let server: AgentServer;
  let ws: WebSocket;

  beforeAll(async () => {
    const dataPath = resolve(__dirname, '../../data');
    const knowledgeBase = new KnowledgeBase(dataPath);
    await knowledgeBase.load();

    const llmClient = new MockLLMClient();

    server = new AgentServer({
      config: {
        llm: {
          provider: 'mock',
          baseUrl: '',
          model: 'mock',
          apiKeyEnvVar: 'TEST_API_KEY',
          maxTokens: 512,
        },
        server: {
          port: TEST_PORT,
          host: TEST_HOST,
        },
      },
      llmClient,
      knowledgeBase,
    });

    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should respond to explain_rule with rule_explanation format', async () => {
    ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    const treeSnapshot = createMinimalTreeSnapshot();

    const request = {
      type: 'explain_rule',
      id: 'req-001',
      payload: {
        treeSnapshot,
        path: [0, 0, 0, 0],
      },
    };

    const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        clearTimeout(timeout);
        try {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          resolve(msg);
        } catch (err) {
          reject(err);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      ws.send(JSON.stringify(request));
    });

    expect(response.type).toBe('rule_explanation');
    expect(response.id).toBe('req-001');

    const payload = response.payload as Record<string, unknown>;
    expect(typeof payload.text).toBe('string');
    expect(payload.text).toBeTruthy();

    ws.close();
  });

  it('should respond to explain_property with property_explanation format', async () => {
    ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    const request = {
      type: 'explain_property',
      id: 'req-002',
      payload: {
        nodeType: 'Symbolizer',
        fieldName: 'markFillColor',
        value: '#FF0000',
      },
    };

    const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        clearTimeout(timeout);
        try {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          resolve(msg);
        } catch (err) {
          reject(err);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      ws.send(JSON.stringify(request));
    });

    expect(response.type).toBe('property_explanation');
    expect(response.id).toBe('req-002');

    const payload = response.payload as Record<string, unknown>;
    expect(typeof payload.text).toBe('string');
    expect(payload.text).toBeTruthy();

    ws.close();
  });

  it('should respond to generate_rules with generated_rules format', async () => {
    ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    const request = {
      type: 'generate_rules',
      id: 'req-003',
      payload: {
        dataSchema: {
          features: [
            { properties: { population: 100 } },
            { properties: { population: 500 } },
            { properties: { population: 1000 } },
            { properties: { population: 2000 } },
            { properties: { population: 5000 } },
          ],
        },
        attribute: 'population',
        method: 'equalInterval',
        classes: 3,
        colorRamp: ['#FFEDA0', '#FEB24C', '#F03B20'],
      },
    };

    const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        clearTimeout(timeout);
        try {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          resolve(msg);
        } catch (err) {
          reject(err);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      ws.send(JSON.stringify(request));
    });

    expect(response.type).toBe('generated_rules');
    expect(response.id).toBe('req-003');

    const payload = response.payload as Record<string, unknown>;
    expect(Array.isArray(payload.rules)).toBe(true);
    expect(payload.rules).toHaveLength(3);

    const rules = payload.rules as Array<Record<string, unknown>>;
    for (const rule of rules) {
      expect(typeof rule.name).toBe('string');
      expect(Array.isArray(rule.symbolizers)).toBe(true);
    }

    ws.close();
  });

  it('should return error for unknown message type', async () => {
    ws = new WebSocket(`ws://${TEST_HOST}:${TEST_PORT}`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    const request = {
      type: 'unknown_type',
      id: 'req-004',
      payload: {},
    };

    const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        clearTimeout(timeout);
        try {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          resolve(msg);
        } catch (err) {
          reject(err);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      ws.send(JSON.stringify(request));
    });

    expect(response.type).toBe('error');
    expect(response.id).toBe('req-004');

    const payload = response.payload as Record<string, unknown>;
    expect(typeof payload.message).toBe('string');
    expect(payload.message).toContain('Unknown');

    ws.close();
  });
});
