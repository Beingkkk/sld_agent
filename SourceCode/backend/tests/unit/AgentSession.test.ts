import { describe, it, expect } from 'vitest';
import { AgentSession } from '../../src/session/AgentSession';
import { SldService } from '../../src/sld/SldService';
import { PromptBuilder } from '../../src/knowledge/PromptBuilder';
import type { Style } from 'geostyler-style';

class FakeLlmClient {
  async complete(): Promise<string> {
    return JSON.stringify({
      style_name: 'test',
      geometry_type: 'point',
      style_type: 'simple',
      fill_color: '#FF0000',
      size: 8,
    });
  }
}

class EchoLlmClient {
  async complete(prompt: string): Promise<string> {
    return prompt.includes('Current StyleParams')
      ? JSON.stringify({
          style_name: 'test',
          geometry_type: 'point',
          style_type: 'simple',
          fill_color: '#00FF00',
          size: 8,
        })
      : '{}';
  }
}

describe('AgentSession', () => {
  const simpleStyle: Style = {
    name: 'Test',
    rules: [{
      name: 'Default',
      symbolizers: [{
        kind: 'Mark',
        wellKnownName: 'circle',
        size: 6,
        color: '#000000',
      }],
    }],
  };

  function createSession(llmClient: { complete(prompt: string): Promise<string> }, kb?: unknown) {
    return new AgentSession({
      id: 'test',
      knowledgeBase: kb || {
        domains: [{ id: 'default', name: '通用', description: '', default: true }],
        activeDomain: 'default',
        styleCatalog: [],
        parameterDictionary: {},
        constraints: [],
        fewShotExamples: [],
        modificationRules: [],
      },
      promptBuilder: new PromptBuilder(),
      sldService: new SldService(),
      llmClient,
    });
  }

  it('imports style and updates current/last valid state', async () => {
    const session = createSession(new FakeLlmClient());
    const result = await session.importStyle({ style: simpleStyle, sourceName: 'test.sld' });
    expect(result.style).toEqual(simpleStyle);
    expect(session.getState().currentStyle).toEqual(simpleStyle);
    expect(session.getState().lastValidStyle).toEqual(simpleStyle);
  });

  it('blocks concurrent generate requests', async () => {
    const session = createSession(new FakeLlmClient());
    const first = session.generate({ instruction: 'x', geometryType: 'point' });
    const second = session.generate({ instruction: 'y', geometryType: 'point' });

    await expect(second).rejects.toThrow('Session is busy');
    await expect(first).resolves.toBeDefined();
  });

  it('generate produces valid SLD and updates state', async () => {
    const session = createSession(new FakeLlmClient());
    const result = await session.generate({ instruction: 'red point', geometryType: 'point' });
    expect(result.style.name).toBe('test');
    expect(result.sldXml).toContain('<StyledLayerDescriptor');
    expect(session.getState().currentStyle?.name).toBe('test');
  });

  it('modify merges with current params and preserves geometry/style type', async () => {
    const session = createSession(new FakeLlmClient());
    await session.generate({ instruction: 'red point', geometryType: 'point' });

    const result = await session.modify({ instruction: 'make it green' });
    expect(result.params.geometry_type).toBe('point');
    expect(result.params.style_type).toBe('simple');
  });
});
