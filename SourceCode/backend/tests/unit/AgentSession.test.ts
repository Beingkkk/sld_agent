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

  describe('applyPatch', () => {
    it('applies replace patch to params and rebuilds style', async () => {
      const session = createSession(new FakeLlmClient());
      await session.generate({ instruction: 'red point', geometryType: 'point' });

      const result = await session.applyPatch({
        patches: [{ op: 'replace', path: '/fill_color', value: '#0000FF' }],
      });

      expect(result.params.fill_color).toBe('#0000FF');
      expect(result.validation.passed).toBe(true);
    });

    it('applies add patch to rules array', async () => {
      const session = createSession(new FakeLlmClient());
      await session.generate({ instruction: 'red point', geometryType: 'point' });

      const result = await session.applyPatch({
        patches: [
          {
            op: 'add',
            path: '/rules/-',
            value: { name: 'New rule', symbolizers: [{ kind: 'Mark', wellKnownName: 'square' }] },
          },
        ],
      });

      expect(result.params.rules).toHaveLength(1);
      expect(result.params.rules?.[0].name).toBe('New rule');
      expect(result.validation.passed).toBe(true);
    });

    it('applies remove patch to rules array', async () => {
      const session = createSession(new FakeLlmClient());
      await session.generate({ instruction: 'red point', geometryType: 'point' });
      await session.applyPatch({
        patches: [
          {
            op: 'add',
            path: '/rules/-',
            value: { name: 'First', symbolizers: [{ kind: 'Mark' }] },
          },
          {
            op: 'add',
            path: '/rules/-',
            value: { name: 'Second', symbolizers: [{ kind: 'Mark' }] },
          },
        ],
      });

      const result = await session.applyPatch({
        patches: [{ op: 'remove', path: '/rules/0' }],
      });

      expect(result.params.rules).toHaveLength(1);
      expect(result.params.rules?.[0].name).toBe('Second');
    });

    it('rejects invalid patch path with schema validation error', async () => {
      const session = createSession(new FakeLlmClient());
      await session.generate({ instruction: 'red point', geometryType: 'point' });

      await expect(
        session.applyPatch({ patches: [{ op: 'replace', path: '/unknown_field', value: 'x' }] })
      ).rejects.toMatchObject({ code: 'SCHEMA_VALIDATION_FAILED' });
    });

    it('rolls back params on validation failure', async () => {
      const session = createSession(new FakeLlmClient());
      await session.generate({ instruction: 'red point', geometryType: 'point' });
      const beforeParams = session.getState().params;

      try {
        await session.applyPatch({
          patches: [{ op: 'replace', path: '/geometry_type', value: 'invalid' }],
        });
      } catch {
        // expected
      }

      expect(session.getState().params).toEqual(beforeParams);
    });
  });
});
