import { describe, it, expect } from 'vitest';
import { RoundtripValidator } from '../../../src/sld/RoundtripValidator.js';
import { SldParserWrapper } from '../../../src/sld/SldParserWrapper.js';
import type { Style } from 'geostyler-style';

describe('RoundtripValidator', () => {
  const parser = new SldParserWrapper();
  const validator = new RoundtripValidator(parser);

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

  it('validates simple style with roundtrip', async () => {
    const result = await validator.validate(simplePointStyle);
    expect(result.passed).toBe(true);
    expect(result.tool).toBe('geostyler-sld-parser');
  });

  it('detects style mismatch on roundtrip', async () => {
    const otherStyle: Style = {
      name: 'Blue point',
      rules: [{
        name: 'Default rule',
        symbolizers: [{
          kind: 'Mark',
          wellKnownName: 'circle',
          size: 8,
          color: '#0000FF',
        }],
      }],
    };
    const xml = await parser.writeStyle(otherStyle);
    const result = await validator.validate(simplePointStyle, xml);
    expect(result.passed).toBe(false);
    expect(result.message).toBe('Roundtrip style mismatch');
  });

  it('handles parser read errors gracefully', async () => {
    const result = await validator.validate(simplePointStyle, '<?xml version="1.0"?><NotAnSld/>');
    expect(result.passed).toBe(false);
    expect(result.tool).toBe('geostyler-sld-parser');
    expect(result.message).toBeTruthy();
  });

  it('uses provided xml instead of writing style', async () => {
    const xml = await parser.writeStyle(simplePointStyle);
    const result = await validator.validate(simplePointStyle, xml);
    expect(result.passed).toBe(true);
  });
});
