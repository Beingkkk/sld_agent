import { describe, it, expect } from 'vitest';
import { XsdValidator } from '../../../src/sld/XsdValidator.js';
import { SldParserWrapper } from '../../../src/sld/SldParserWrapper.js';
import type { Style } from 'geostyler-style';

describe('XsdValidator', () => {
  const parser = new SldParserWrapper();

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

  async function simpleSldXml(): Promise<string> {
    return parser.writeStyle(simplePointStyle);
  }

  it('validates SLD XML against OGC XSD using xmllint-wasm', async () => {
    const validator = new XsdValidator();
    const result = await validator.validate(await simpleSldXml());
    expect(result.passed).toBe(true);
    expect(result.tool).toBe('xmllint-wasm');
    expect(result.durationMs).toBeDefined();
  });

  it('fails XSD validation for malformed SLD', async () => {
    const validator = new XsdValidator();
    const result = await validator.validate('<?xml version="1.0"?><NotAnSld/>');
    expect(result.passed).toBe(false);
    expect(result.tool).toBe('xmllint-wasm');
    expect(result.message).toBeTruthy();
  });

  it('does not use xmllint-wasm when useWasm is false', async () => {
    const validator = new XsdValidator({ useWasm: false });
    const result = await validator.validate(await simpleSldXml());
    expect(result.tool).not.toBe('xmllint-wasm');
  });

  it('skips XSD when skipXsd is true and no validator is available', async () => {
    const validator = new XsdValidator({
      useWasm: false,
      wasmSchemaBundleDir: '/nonexistent',
      skipXsd: true,
    });
    const result = await validator.validate(await simpleSldXml());
    expect(result.passed).toBe(true);
    expect(result.tool).toBe('none');
  });

  it('returns failure when no validator is available and skipXsd is false', async () => {
    const validator = new XsdValidator({
      useWasm: false,
      skipXsd: false,
    });
    const result = await validator.validate(await simpleSldXml());
    expect(result.passed).toBe(false);
    expect(result.tool).toBe('none');
    expect(result.message).toContain('not configured');
  });
});
