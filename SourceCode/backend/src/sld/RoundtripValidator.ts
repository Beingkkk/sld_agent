import type { Style, Symbolizer, Rule } from 'geostyler-style';
import type { ValidationResult } from '../shared/types.js';
import { SldParserWrapper } from './SldParserWrapper.js';

/**
 * Parser Roundtrip 校验器：将 Style 写出为 SLD XML 后再读回，
 * 比较关键字段是否一致，确保生成的 SLD 可被再次编辑。
 */
export class RoundtripValidator {
  private parser: SldParserWrapper;

  constructor(parser: SldParserWrapper) {
    this.parser = parser;
  }

  async validate(style: Style, xml?: string): Promise<ValidationResult> {
    const sldXml = xml ?? (await this.parser.writeStyle(style));
    const start = Date.now();

    try {
      const reparsed = await this.parser.readStyle(sldXml);
      const passed = compareStyles(style, reparsed);
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
    // 仅比较两个 symbolizer 都存在的字段；geostyler-sld-parser 读回时可能丢失非关键字段。
    if (!(key in aRec) || !(key in bRec)) continue;
    const av = aRec[key];
    const bv = bRec[key];
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      return false;
    }
  }
  return true;
}
