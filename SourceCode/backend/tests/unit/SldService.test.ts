import { describe, it, expect } from 'vitest';
import { SldService } from '../../src/sld/SldService.js';
import type { Style } from 'geostyler-style';

describe('SldService', () => {
  const service = new SldService();

  const simplePointStyle: Style = {
    name: 'Red point',
    rules: [{
      name: 'Default rule',
      symbolizers: [{
        kind: 'Mark',
        wellKnownName: 'circle',
        size: 8,
        color: '#FF0000',
      }],
    }],
  };

  it('writes SLD XML', async () => {
    const xml = await service.writeStyle(simplePointStyle);
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<StyledLayerDescriptor');
    expect(xml).toContain('<Mark>');
  });

  it('validates simple style with roundtrip', async () => {
    const report = await service.validate(simplePointStyle);
    expect(report.roundtrip?.passed).toBe(true);
  });

  it('returns validation report with xsd passed', async () => {
    const report = await service.validate(simplePointStyle);
    expect(report.passed).toBe(true);
    expect(report.xsd?.passed).toBe(true);
    expect(report.xsd?.tool).toBe('xmllint-wasm');
  });
});
