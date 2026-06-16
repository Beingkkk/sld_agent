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

  describe('applyPatch', () => {
    it('optimistically updates params before backend response', async () => {
      const result = {
        style: { name: 's' },
        sldXml: '<xml/>',
        params: { style_name: 's', geometry_type: 'point', style_type: 'simple', fill_color: '#00FF00' },
        validation: { passed: true, errors: [] },
        explanation: 'ok',
      };
      mockSend.mockResolvedValue(result);

      const store = useStyleStore();
      store.applyResult({
        style: { name: 's' },
        sldXml: '<xml/>',
        params: { style_name: 's', geometry_type: 'point', style_type: 'simple', fill_color: '#FF0000' },
        validation: { passed: true, errors: [] },
        explanation: 'initial',
      });

      const promise = store.applyPatch([{ op: 'replace', path: '/fill_color', value: '#00FF00' }]);

      expect(store.params?.fill_color).toBe('#00FF00');
      await promise;
      expect(mockSend).toHaveBeenCalledWith('apply_patch', { patches: [{ op: 'replace', path: '/fill_color', value: '#00FF00' }] });
    });

    it('updates currentStyle after successful applyPatch', async () => {
      const result = {
        style: { name: 'Updated', rules: [{ name: 'Default', symbolizers: [{ kind: 'Mark' }] }] },
        sldXml: '<xml/>',
        params: { style_name: 'Updated', geometry_type: 'point', style_type: 'simple' },
        validation: { passed: true, errors: [] },
        explanation: 'ok',
      };
      mockSend.mockResolvedValue(result);

      const store = useStyleStore();
      store.applyResult({
        style: { name: 's' },
        sldXml: '<xml/>',
        params: { style_name: 's', geometry_type: 'point', style_type: 'simple' },
        validation: { passed: true, errors: [] },
        explanation: 'initial',
      });

      await store.applyPatch([{ op: 'replace', path: '/fill_color', value: '#0000FF' }]);
      expect(store.currentStyle).toEqual(result.style);
    });

    it('rolls back params and currentStyle on failure', async () => {
      mockSend.mockRejectedValue(new Error('Validation failed'));

      const initialParams = { style_name: 's', geometry_type: 'point', style_type: 'simple', fill_color: '#FF0000' };
      const initialStyle = { name: 's' };
      const store = useStyleStore();
      store.applyResult({
        style: initialStyle,
        sldXml: '<xml/>',
        params: initialParams,
        validation: { passed: true, errors: [] },
        explanation: 'initial',
      });

      await expect(
        store.applyPatch([{ op: 'replace', path: '/fill_color', value: '#00FF00' }])
      ).rejects.toThrow('Validation failed');

      expect(store.params).toEqual(initialParams);
      expect(store.currentStyle).toEqual(initialStyle);
    });

    it('clears busy flag after applyPatch failure', async () => {
      mockSend.mockRejectedValue(new Error('Validation failed'));
      const store = useStyleStore();
      store.applyResult({
        style: { name: 's' },
        sldXml: '<xml/>',
        params: { style_name: 's', geometry_type: 'point', style_type: 'simple' },
        validation: { passed: true, errors: [] },
        explanation: 'initial',
      });

      await expect(
        store.applyPatch([{ op: 'replace', path: '/fill_color', value: '#00FF00' }])
      ).rejects.toThrow('Validation failed');

      expect(store.busy).toBe(false);
    });
  });
});
