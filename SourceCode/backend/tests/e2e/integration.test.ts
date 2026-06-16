import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../src/server.js';
import type { WsServerOptions } from '../../src/types.js';
import type { KnowledgeBase } from '../../src/knowledge/types.js';
import type { StyleParams, StylePatch } from '@sldagent/shared/types';

const DATA_DIR = fileURLToPath(new URL('../../../data', import.meta.url));

class FakeLlmClient {
  constructor(private responses: object[]) {}

  async complete(): Promise<string> {
    const response = this.responses.shift();
    if (!response) {
      throw new Error('FakeLlmClient response queue exhausted');
    }
    return JSON.stringify(response);
  }
}

const knowledgeBase: KnowledgeBase = {
  domains: [{ id: 'default', name: '通用', description: '', default: true }],
  activeDomain: 'default',
  styleCatalog: [],
  parameterDictionary: {},
  constraints: [],
  fewShotExamples: [],
  modificationRules: [],
};

function baseParams(geometryType: 'point' | 'line' | 'polygon'): StyleParams {
  return {
    style_name: 'Test',
    geometry_type: geometryType,
    style_type: 'simple',
  };
}

describe('Backend E2E Integration', () => {
  let server: ReturnType<typeof createServer>;
  let ws: WebSocket;
  let requestId = 0;

  beforeAll(async () => {
    const options: WsServerOptions = {
      port: 0,
      knowledgeDir: '/dev/null',
      dataDir: DATA_DIR,
      skipXsd: true,
      knowledgeBase,
    };
    server = createServer(options);
    const { url } = await server.start();
    ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
  });

  afterAll(async () => {
    ws.close();
    await server.stop();
  });

  function send(type: string, payload: unknown): Promise<unknown> {
    const id = `req-${++requestId}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Request timeout')), 5000);
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === id) {
          clearTimeout(timer);
          ws.off('message', handler);
          if (msg.type === 'error') {
            reject(new Error(msg.payload.message));
          } else {
            resolve(msg.payload);
          }
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ type, requestId: id, payload }));
    });
  }

  it('responds to ping with pong', async () => {
    const result = await send('ping', {});
    expect(result).toHaveProperty('timestamp');
  });

  it('generate produces a simple point style', async () => {
    const llmClient = new FakeLlmClient([{
      ...baseParams('point'),
      fill_color: '#FF0000',
      size: 8,
    }]);

    const testServer = createServer({
      port: 0,
      knowledgeDir: '/dev/null',
      skipXsd: true,
      knowledgeBase,
      llmClient,
    });
    const { url } = await testServer.start();
    const testWs = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      testWs.on('open', resolve);
      testWs.on('error', reject);
    });

    const result = await new Promise<unknown>((resolve, reject) => {
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === 'gen-1') {
          testWs.off('message', handler);
          if (msg.type === 'error') reject(new Error(msg.payload.message));
          else resolve(msg.payload);
        }
      };
      testWs.on('message', handler);
      testWs.send(JSON.stringify({
        type: 'generate',
        requestId: 'gen-1',
        payload: { instruction: 'red point', geometryType: 'point' },
      }));
    });

    expect(result).toHaveProperty('style');
    expect(result).toHaveProperty('sldXml');
    expect((result as { sldXml: string }).sldXml).toContain('<StyledLayerDescriptor');
    expect((result as { validation: { passed: boolean } }).validation.passed).toBe(true);

    testWs.close();
    await testServer.stop();
  });

  it('generate produces a simple line style', async () => {
    const llmClient = new FakeLlmClient([{
      ...baseParams('line'),
      stroke_color: '#0000FF',
      stroke_width: 2,
      opacity: 1,
    }]);

    const testServer = createServer({
      port: 0,
      knowledgeDir: '/dev/null',
      skipXsd: true,
      knowledgeBase,
      llmClient,
    });
    const { url } = await testServer.start();
    const testWs = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      testWs.on('open', resolve);
      testWs.on('error', reject);
    });

    const result = await new Promise<unknown>((resolve, reject) => {
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === 'gen-line') {
          testWs.off('message', handler);
          if (msg.type === 'error') reject(new Error(msg.payload.message));
          else resolve(msg.payload);
        }
      };
      testWs.on('message', handler);
      testWs.send(JSON.stringify({
        type: 'generate',
        requestId: 'gen-line',
        payload: { instruction: 'blue line', geometryType: 'line' },
      }));
    });

    expect((result as { sldXml: string }).sldXml).toContain('<LineSymbolizer');

    testWs.close();
    await testServer.stop();
  });

  it('generate produces a categorized style with explicit default rule', async () => {
    const llmClient = new FakeLlmClient([{
      ...baseParams('point'),
      style_type: 'categorized',
      field_name: 'type',
      categories: [
        { value: 'road', fill_color: '#FF0000' },
        { value: 'rail', fill_color: '#0000FF' },
      ],
    }]);

    const testServer = createServer({
      port: 0,
      knowledgeDir: '/dev/null',
      skipXsd: true,
      knowledgeBase,
      llmClient,
    });
    const { url } = await testServer.start();
    const testWs = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      testWs.on('open', resolve);
      testWs.on('error', reject);
    });

    const result = await new Promise<unknown>((resolve, reject) => {
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === 'gen-cat') {
          testWs.off('message', handler);
          if (msg.type === 'error') reject(new Error(msg.payload.message));
          else resolve(msg.payload);
        }
      };
      testWs.on('message', handler);
      testWs.send(JSON.stringify({
        type: 'generate',
        requestId: 'gen-cat',
        payload: { instruction: 'categorized points', geometryType: 'point' },
      }));
    });

    const style = (result as { style: { rules: unknown[] } }).style;
    expect(style.rules.length).toBeGreaterThanOrEqual(2);

    testWs.close();
    await testServer.stop();
  });

  it('generate produces a classified style', async () => {
    const llmClient = new FakeLlmClient([{
      ...baseParams('point'),
      style_type: 'classified',
      field_name: 'population',
      classes: 3,
      classification_method: 'equalInterval',
      color_ramp: ['#FF0000', '#00FF00', '#0000FF'],
    }]);

    const testServer = createServer({
      port: 0,
      knowledgeDir: '/dev/null',
      skipXsd: true,
      knowledgeBase,
      llmClient,
    });
    const { url } = await testServer.start();
    const testWs = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      testWs.on('open', resolve);
      testWs.on('error', reject);
    });

    const result = await new Promise<unknown>((resolve, reject) => {
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === 'gen-cls') {
          testWs.off('message', handler);
          if (msg.type === 'error') reject(new Error(msg.payload.message));
          else resolve(msg.payload);
        }
      };
      testWs.on('message', handler);
      testWs.send(JSON.stringify({
        type: 'generate',
        requestId: 'gen-cls',
        payload: { instruction: 'classified points', geometryType: 'point' },
      }));
    });

    const style = (result as { style: { rules: unknown[] } }).style;
    expect(style.rules.length).toBe(3);

    testWs.close();
    await testServer.stop();
  });

  it('generate produces a text style', async () => {
    const llmClient = new FakeLlmClient([{
      ...baseParams('point'),
      style_type: 'text',
      label: 'name',
      font_size: 12,
      stroke_color: '#000000',
    }]);

    const testServer = createServer({
      port: 0,
      knowledgeDir: '/dev/null',
      skipXsd: true,
      knowledgeBase,
      llmClient,
    });
    const { url } = await testServer.start();
    const testWs = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      testWs.on('open', resolve);
      testWs.on('error', reject);
    });

    const result = await new Promise<unknown>((resolve, reject) => {
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === 'gen-text') {
          testWs.off('message', handler);
          if (msg.type === 'error') reject(new Error(msg.payload.message));
          else resolve(msg.payload);
        }
      };
      testWs.on('message', handler);
      testWs.send(JSON.stringify({
        type: 'generate',
        requestId: 'gen-text',
        payload: { instruction: 'label points', geometryType: 'point' },
      }));
    });

    const sldXml = (result as { sldXml: string }).sldXml;
    expect(sldXml).toContain('<TextSymbolizer');

    testWs.close();
    await testServer.stop();
  });

  it('modify preserves geometry_type and style_type', async () => {
    const llmClient = new FakeLlmClient([
      { ...baseParams('point'), fill_color: '#FF0000', size: 8 },
      { ...baseParams('point'), fill_color: '#00FF00', size: 8 },
    ]);

    const testServer = createServer({
      port: 0,
      knowledgeDir: '/dev/null',
      skipXsd: true,
      knowledgeBase,
      llmClient,
    });
    const { url } = await testServer.start();
    const testWs = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      testWs.on('open', resolve);
      testWs.on('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === 'gen-mod') {
          testWs.off('message', handler);
          if (msg.type === 'error') reject(new Error(msg.payload.message));
          else resolve();
        }
      };
      testWs.on('message', handler);
      testWs.send(JSON.stringify({
        type: 'generate',
        requestId: 'gen-mod',
        payload: { instruction: 'red point', geometryType: 'point' },
      }));
    });

    const result = await new Promise<unknown>((resolve, reject) => {
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === 'mod-1') {
          testWs.off('message', handler);
          if (msg.type === 'error') reject(new Error(msg.payload.message));
          else resolve(msg.payload);
        }
      };
      testWs.on('message', handler);
      testWs.send(JSON.stringify({
        type: 'modify',
        requestId: 'mod-1',
        payload: { instruction: 'make it green' },
      }));
    });

    const params = (result as { params: StyleParams }).params;
    expect(params.geometry_type).toBe('point');
    expect(params.style_type).toBe('simple');
    expect(params.fill_color).toBe('#00FF00');

    testWs.close();
    await testServer.stop();
  });

  it('apply_patch updates style params and rebuilds', async () => {
    const llmClient = new FakeLlmClient([{
      ...baseParams('point'),
      fill_color: '#FF0000',
      size: 8,
    }]);

    const testServer = createServer({
      port: 0,
      knowledgeDir: '/dev/null',
      skipXsd: true,
      knowledgeBase,
      llmClient,
    });
    const { url } = await testServer.start();
    const testWs = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      testWs.on('open', resolve);
      testWs.on('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === 'gen-patch') {
          testWs.off('message', handler);
          if (msg.type === 'error') reject(new Error(msg.payload.message));
          else resolve();
        }
      };
      testWs.on('message', handler);
      testWs.send(JSON.stringify({
        type: 'generate',
        requestId: 'gen-patch',
        payload: { instruction: 'red point', geometryType: 'point' },
      }));
    });

    const patch: StylePatch = { op: 'replace', path: '/fill_color', value: '#0000FF' };
    const result = await new Promise<unknown>((resolve, reject) => {
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === 'patch-1') {
          testWs.off('message', handler);
          if (msg.type === 'error') reject(new Error(msg.payload.message));
          else resolve(msg.payload);
        }
      };
      testWs.on('message', handler);
      testWs.send(JSON.stringify({
        type: 'apply_patch',
        requestId: 'patch-1',
        payload: { patches: [patch] },
      }));
    });

    expect((result as { params: StyleParams }).params.fill_color).toBe('#0000FF');
    expect((result as { validation: { passed: boolean } }).validation.passed).toBe(true);

    testWs.close();
    await testServer.stop();
  });

  it('blocks concurrent generate requests', async () => {
    const llmClient = new FakeLlmClient([{ ...baseParams('point'), fill_color: '#FF0000', size: 8 }]);

    const testServer = createServer({
      port: 0,
      knowledgeDir: '/dev/null',
      dataDir: DATA_DIR,
      skipXsd: true,
      knowledgeBase,
      llmClient,
    });
    const { url } = await testServer.start();
    const testWs = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      testWs.on('open', resolve);
      testWs.on('error', reject);
    });

    // Send first generate but do not wait.
    testWs.send(JSON.stringify({
      type: 'generate',
      requestId: 'concurrent-1',
      payload: { instruction: 'red point', geometryType: 'point' },
    }));

    // Immediately send second generate and wait for error response.
    const error = await new Promise<{ busy?: boolean; message: string }>((resolve) => {
      const handler = (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === 'concurrent-2' && msg.type === 'error') {
          testWs.off('message', handler);
          resolve(msg.payload);
        }
      };
      testWs.on('message', handler);
      testWs.send(JSON.stringify({
        type: 'generate',
        requestId: 'concurrent-2',
        payload: { instruction: 'blue point', geometryType: 'point' },
      }));
    });

    expect(error.busy).toBe(true);

    testWs.close();
    await testServer.stop();
  });

  it('list_sample_datasets returns discovered datasets', async () => {
    const result = await send('list_sample_datasets', {});
    expect(result).toHaveProperty('datasets');
    const datasets = (result as { datasets: Array<{ id: string; geometryType: string }> }).datasets;
    const ids = datasets.map((d) => d.id).sort();
    expect(ids).toContain('sld_cookbook_point');
    expect(ids).toContain('sld_cookbook_line');
    expect(ids).toContain('sld_cookbook_polygon');
  });

  it('get_sample_dataset returns GeoJSON for each geometry type', async () => {
    const { datasets } = (await send('list_sample_datasets', {})) as { datasets: Array<{ id: string }> };
    expect(datasets.length).toBeGreaterThanOrEqual(3);

    for (const dataset of datasets) {
      const result = await send('get_sample_dataset', { id: dataset.id });
      expect(result).toHaveProperty('geojson');
      expect(result).toHaveProperty('extent');
      const data = result as { geojson: { type: string; features: unknown[] }; extent: number[] };
      expect(data.geojson.type).toBe('FeatureCollection');
      expect(data.geojson.features.length).toBeGreaterThan(0);
      expect(data.extent.length).toBe(4);
    }
  });
});
