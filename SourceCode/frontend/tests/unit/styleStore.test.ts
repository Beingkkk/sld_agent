import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useStyleStore } from '../../src/stores/styleStore';

const mockSend = vi.fn();
vi.mock('../../src/services/wsClient', () => ({
  createWsClient: () => ({
    connect: vi.fn().mockResolvedValue(undefined),
    generate: (payload: unknown) => mockSend('generate', payload),
    modify: (payload: unknown) => mockSend('modify', payload),
    applyPatch: (payload: unknown) => mockSend('apply_patch', payload),
    exportStyle: () => mockSend('export', {}),
    importStyle: (payload: unknown) => mockSend('import_style', payload),
    validate: () => mockSend('validate', {}),
    setDomain: (domain: string) => mockSend('set_domain', { domain }),
  }),
}));

describe('StyleStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockSend.mockReset();
  });

  it('calls generate with instruction and geometryType', async () => {
    const result = {
      style: { name: 's' },
      sldXml: '<xml/>',
      params: { style_name: 's', geometry_type: 'point', style_type: 'simple' },
      validation: { passed: true, errors: [] },
      explanation: 'ok',
    };
    mockSend.mockResolvedValue(result);

    const store = useStyleStore();
    await store.generate('red point', 'point');

    expect(mockSend).toHaveBeenCalledWith('generate', { instruction: 'red point', geometryType: 'point' });
    expect(store.currentStyle).toEqual(result.style);
    expect(store.explanation).toBe('ok');
  });

  it('tracks lastValidStyle after successful generate', async () => {
    const result = {
      style: { name: 's' },
      sldXml: '<xml/>',
      params: { style_name: 's', geometry_type: 'point', style_type: 'simple' },
      validation: { passed: true, errors: [] },
      explanation: 'ok',
    };
    mockSend.mockResolvedValue(result);

    const store = useStyleStore();
    await store.generate('red point', 'point');
    expect(store.lastValidStyle).toEqual(result.style);
  });

  it('exports SLD XML', async () => {
    mockSend.mockResolvedValue({ sldXml: '<xml/>', validation: { passed: true, errors: [] } });
    const store = useStyleStore();
    const xml = await store.exportSld();
    expect(xml).toBe('<xml/>');
  });
});
