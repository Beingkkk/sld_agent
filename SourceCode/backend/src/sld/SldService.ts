import SldParser from 'geostyler-sld-parser';
import type { Style, Symbolizer, Rule } from 'geostyler-style';
import type {
  SldServiceOptions,
  WriteOptions,
  ValidationReport,
  ValidationResult,
} from '../shared/types.js';

export { SldServiceOptions, WriteOptions, ValidationReport, ValidationResult };

export interface ISldService {
  writeStyle(style: Style, options?: WriteOptions): Promise<string>;
  readStyle(xml: string): Promise<Style>;
  validate(style: Style, xml?: string): Promise<ValidationReport>;
  validateXsd(xml: string): Promise<ValidationResult>;
  validateRoundtrip(style: Style, xml?: string): Promise<ValidationResult>;
}

export class SldService implements ISldService {
  private parser = new SldParser();
  private options: SldServiceOptions;

  constructor(options: SldServiceOptions = {}) {
    this.options = options;
  }

  async writeStyle(style: Style, options?: WriteOptions): Promise<string> {
    const { output } = await this.parser.writeStyle(style);
    if (!output) {
      throw new Error('geostyler-sld-parser returned empty output');
    }
    const pretty = options?.prettyPrint ?? true;
    if (pretty) {
      const { default: format } = await import('xml-formatter');
      return format(output, { indentation: '  ', collapseContent: true });
    }
    return output;
  }

  async readStyle(xml: string): Promise<Style> {
    const cleaned = stripSymbolizerGeometry(xml);
    const { output, errors } = await this.parser.readStyle(cleaned);
    if (errors?.length) {
      throw new Error(`Failed to parse SLD: ${errors.map((e) => e.message).join(', ')}`);
    }
    return output as Style;
  }

  async validate(style: Style, xml?: string): Promise<ValidationReport> {
    let sldXml: string;
    try {
      sldXml = xml ?? (await this.writeStyle(style));
    } catch (err) {
      return report({
        xsd: {
          passed: false,
          message: `Failed to write SLD: ${err instanceof Error ? err.message : String(err)}`,
          tool: 'geostyler-sld-parser',
        },
      });
    }

    const [xsd, roundtrip] = await Promise.all([
      this.validateXsd(sldXml),
      this.validateRoundtrip(style, sldXml),
    ]);

    return report({ xsd, roundtrip });
  }

  async validateXsd(xml: string): Promise<ValidationResult> {
    const start = Date.now();

    // 1. Try xmllint-wasm bundle if configured.
    if (this.options.useWasm && this.options.wasmSchemaBundleDir) {
      try {
        return await validateWithWasm(xml, this.options.wasmSchemaBundleDir, start);
      } catch (err) {
        if (!this.options.skipXsd) {
          return {
            passed: false,
            durationMs: Date.now() - start,
            tool: 'xmllint-wasm',
            message: `Wasm XSD validation failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
    }

    // 2. Try system xmllint if XSD path is provided.
    if (this.options.xsdPath) {
      try {
        return await validateWithSystemXmllint(xml, this.options.xsdPath, this.options.xmllintPath, start);
      } catch (err) {
        if (!this.options.skipXsd) {
          return {
            passed: false,
            durationMs: Date.now() - start,
            tool: 'xmllint',
            message: `System XSD validation failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
    }

    // 3. Skip if allowed.
    if (this.options.skipXsd ?? true) {
      return {
        passed: true,
        tool: 'none',
        message: 'XSD validation skipped (no validator configured)',
      };
    }

    return {
      passed: false,
      durationMs: Date.now() - start,
      tool: 'none',
      message: 'XSD validation not configured and skipXsd is false',
    };
  }

  async validateRoundtrip(style: Style, xml?: string): Promise<ValidationResult> {
    const sldXml = xml ?? (await this.writeStyle(style));
    const start = Date.now();
    try {
      const { output: reparsed } = await this.parser.readStyle(sldXml);
      const passed = compareStyles(style, reparsed as Style);
      return {
        passed,
        durationMs: Date.now() - start,
        tool: 'geostyler-sld-parser',
        message: passed ? undefined : 'Roundtrip style mismatch',
      };
    } catch (err) {
      return {
        passed: false,
        durationMs: Date.now() - start,
        tool: 'geostyler-sld-parser',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export function createSldService(options?: SldServiceOptions): ISldService {
  return new SldService(options);
}

function stripSymbolizerGeometry(xml: string): string {
  return xml.replace(/<\w*:?Geometry\b[^>]*>[\s\S]*?<\/\w*:?Geometry\s*>/g, '');
}

function compareStyles(a: Style, b: Style): boolean {
  if (a.name !== b.name) return false;
  if (a.rules.length !== b.rules.length) return false;
  return a.rules.every((rule, i) => compareRules(rule, b.rules[i]));
}

function compareRules(a: Rule, b: Rule): boolean {
  if (a.name !== b.name) return false;
  if (a.symbolizers.length !== b.symbolizers.length) return false;
  if (JSON.stringify(a.filter ?? null) !== JSON.stringify(b.filter ?? null)) return false;
  if (JSON.stringify(a.scaleDenominator ?? null) !== JSON.stringify(b.scaleDenominator ?? null)) return false;
  return a.symbolizers.every((sym, i) => compareSymbolizers(sym, b.symbolizers[i]));
}

function compareSymbolizers(a: Symbolizer, b: Symbolizer): boolean {
  if (a.kind !== b.kind) return false;

  const coreFields: Record<string, string[]> = {
    Mark: ['kind', 'wellKnownName', 'size', 'color', 'strokeColor', 'strokeWidth', 'rotate'],
    Line: ['kind', 'color', 'width', 'opacity', 'dasharray', 'lineCap', 'lineJoin'],
    Fill: ['kind', 'color', 'opacity', 'outlineColor', 'outlineWidth', 'outlineOpacity'],
    Text: ['kind', 'label', 'font', 'size', 'color', 'haloColor', 'haloWidth', 'placement', 'offset'],
    Raster: ['kind', 'opacity'],
  };

  const fields = coreFields[a.kind] ?? ['kind'];
  const aRec = a as unknown as Record<string, unknown>;
  const bRec = b as unknown as Record<string, unknown>;

  for (const key of fields) {
    // Only compare fields present in both symbolizers.
    // geostyler-sld-parser may drop non-critical fields on read.
    if (!(key in aRec) || !(key in bRec)) continue;
    const av = aRec[key];
    const bv = bRec[key];
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      return false;
    }
  }
  return true;
}

function report(results: { xsd?: ValidationResult; roundtrip?: ValidationResult }): ValidationReport {
  const errors: { source: 'xsd' | 'roundtrip'; message: string }[] = [];
  if (results.xsd && !results.xsd.passed) {
    errors.push({ source: 'xsd', message: results.xsd.message || 'XSD validation failed' });
  }
  if (results.roundtrip && !results.roundtrip.passed) {
    errors.push({ source: 'roundtrip', message: results.roundtrip.message || 'Roundtrip validation failed' });
  }
  return { passed: errors.length === 0, xsd: results.xsd, roundtrip: results.roundtrip, errors };
}

async function validateWithSystemXmllint(
  xml: string,
  xsdPath: string,
  xmllintPath: string | undefined,
  start: number
): Promise<ValidationResult> {
  const { execFile } = await import('node:child_process');
  const { writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const tmpFile = join(tmpdir(), `sld-${Date.now()}.xml`);
  await writeFile(tmpFile, xml, 'utf-8');

  return new Promise((resolve, reject) => {
    execFile(xmllintPath || 'xmllint', ['--noout', '--schema', xsdPath, tmpFile], (err, _stdout, stderr) => {
      if (err && err.code !== 0) {
        reject(new Error(stderr || err.message));
      } else {
        resolve({
          passed: true,
          durationMs: Date.now() - start,
          tool: xmllintPath || 'xmllint',
        });
      }
    });
  });
}

async function validateWithWasm(
  xml: string,
  bundleDir: string,
  start: number
): Promise<ValidationResult> {
  const { validateXML } = await import('xmllint-wasm');
  const { readdir, readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');

  const files = await readdir(bundleDir);
  const schemaFile = files.find((f) => f.toLowerCase().includes('styledlayerdescriptor') && f.endsWith('.xsd'));
  if (!schemaFile) {
    throw new Error('No StyledLayerDescriptor.xsd found in wasm schema bundle');
  }

  const preload = await Promise.all(
    files
      .filter((f) => f.endsWith('.xsd') && f !== schemaFile)
      .map(async (file) => ({
        fileName: file,
        contents: await readFile(join(bundleDir, file), 'utf-8'),
      }))
  );

  const result = await validateXML({
    xml: [{ fileName: 'sld.xml', contents: xml }],
    schema: [{ fileName: schemaFile, contents: await readFile(join(bundleDir, schemaFile), 'utf-8') }],
    preload,
  });

  if (!result.valid) {
    const messages = result.errors.map((e) => e.message).join('; ');
    throw new Error(messages);
  }

  return {
    passed: true,
    durationMs: Date.now() - start,
    tool: 'xmllint-wasm',
  };
}
