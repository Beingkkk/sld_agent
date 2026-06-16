import type { Style, Rule, Symbolizer, Filter } from 'geostyler-style';
import type { DataSchema, PropertySchema, StyleParams } from '@sldagent/shared/types';
import { BuilderError } from '../../errors.js';
import type { KnowledgeBase } from '../../knowledge/types.js';

export interface BuilderDeps {
  resolver: DefaultValueResolver;
  ruleGenerator?: RuleGenerator;
  dataSchema?: DataSchema;
  knowledgeBase?: KnowledgeBase;
}

export class DefaultValueResolver {
  private knowledgeBase?: KnowledgeBase;

  constructor(knowledgeBase?: KnowledgeBase) {
    this.knowledgeBase = knowledgeBase;
  }

  resolve(kind: string, field: string): unknown {
    // 1. Query active knowledge base parameter dictionary first.
    const key = `${kind.toLowerCase()}.${field}`;
    const kbDefault = this.knowledgeBase?.parameterDictionary[key]?.default;
    if (kbDefault !== undefined) {
      return kbDefault;
    }

    // 2. Hard-coded fallback for MVP.
    const fallbacks: Record<string, Record<string, unknown>> = {
      Mark: { size: 6, color: '#000000' },
      Line: { width: 1, color: '#000000', opacity: 1 },
      Fill: { color: '#808080', opacity: 1 },
      Text: { size: 12, color: '#000000' },
    };
    return fallbacks[kind]?.[field];
  }
}

export class RuleGenerator {
  computeBreaks(field: string, method: string, classes: number, dataSchema?: DataSchema): number[] {
    const prop = dataSchema?.properties.find((p) => p.name === field);
    const min = prop?.min ?? 0;
    const max = prop?.max ?? classes * 100;
    const samples = extractNumericSamples(prop);

    if (samples && samples.length >= classes) {
      switch (method) {
        case 'equalInterval':
          return equalIntervalBreaks(min, max, classes);
        case 'quantile':
          return quantileBreaks(samples, classes) ?? equalIntervalBreaks(min, max, classes);
        case 'naturalBreaks':
          return naturalBreaks(samples, classes) ?? equalIntervalBreaks(min, max, classes);
        default:
          return equalIntervalBreaks(min, max, classes);
      }
    }

    return equalIntervalBreaks(min, max, classes);
  }
}

function equalIntervalBreaks(min: number, max: number, classes: number): number[] {
  const breaks: number[] = [min];
  for (let i = 1; i < classes; i++) {
    breaks.push(min + ((max - min) * i) / classes);
  }
  breaks.push(max);
  return breaks;
}

function extractNumericSamples(prop?: PropertySchema): number[] | undefined {
  if (!prop?.samples || prop.samples.length === 0) {
    return undefined;
  }
  const numeric = prop.samples.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  return numeric.length >= 2 ? numeric : undefined;
}

function quantileBreaks(values: number[], classes: number): number[] | undefined {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const breaks: number[] = [sorted[0]];
  for (let i = 1; i < classes; i++) {
    const idx = Math.floor((n * i) / classes);
    breaks.push(sorted[idx]);
  }
  breaks.push(sorted[n - 1]);
  return makeStrictlyIncreasing(sorted, breaks);
}

function naturalBreaks(values: number[], classes: number): number[] | undefined {
  if (classes < 1 || classes >= values.length) {
    return undefined;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const matrices = jenksMatrices(sorted, classes);
  const breaks = jenksBreaks(sorted, matrices.lowerClassLimits, classes);
  return makeStrictlyIncreasing(sorted, breaks);
}

function jenksMatrices(data: number[], nClasses: number): { lowerClassLimits: number[][]; varianceCombinations: number[][] } {
  const lowerClassLimits: number[][] = [];
  const varianceCombinations: number[][] = [];
  for (let i = 0; i < data.length + 1; i++) {
    lowerClassLimits.push(new Array(nClasses + 1).fill(0));
    varianceCombinations.push(new Array(nClasses + 1).fill(0));
  }

  for (let i = 1; i < nClasses + 1; i++) {
    lowerClassLimits[1][i] = 1;
    varianceCombinations[1][i] = 0;
    for (let j = 2; j < data.length + 1; j++) {
      varianceCombinations[j][i] = Number.POSITIVE_INFINITY;
    }
  }

  for (let l = 2; l < data.length + 1; l++) {
    let sum = 0;
    let sumSquares = 0;
    let w = 0;
    for (let m = 1; m < l + 1; m++) {
      const lowerClassLimit = l - m + 1;
      const val = data[lowerClassLimit - 1];
      w++;
      sum += val;
      sumSquares += val * val;
      const variance = sumSquares - (sum * sum) / w;
      const i4 = lowerClassLimit - 1;
      if (i4 !== 0) {
        for (let j = 2; j < nClasses + 1; j++) {
          if (varianceCombinations[l][j] >= variance + varianceCombinations[i4][j - 1]) {
            lowerClassLimits[l][j] = lowerClassLimit;
            varianceCombinations[l][j] = variance + varianceCombinations[i4][j - 1];
          }
        }
      }
    }
    lowerClassLimits[l][1] = 1;
    varianceCombinations[l][1] = sumSquares - (sum * sum) / w;
  }

  return { lowerClassLimits, varianceCombinations };
}

function jenksBreaks(data: number[], lowerClassLimits: number[][], nClasses: number): number[] {
  const breaks: number[] = [];
  let k = data.length;
  let countNum = nClasses;

  breaks[nClasses] = data[data.length - 1];

  while (countNum > 0) {
    breaks[countNum - 1] = data[lowerClassLimits[k][countNum] - 1];
    k = lowerClassLimits[k][countNum] - 1;
    countNum--;
  }

  return breaks;
}

function makeStrictlyIncreasing(sorted: number[], breaks: number[]): number[] | undefined {
  const result: number[] = [breaks[0]];
  for (let i = 1; i < breaks.length; i++) {
    const prev = result[result.length - 1];
    if (breaks[i] > prev) {
      result.push(breaks[i]);
    } else {
      const next = sorted.find((v) => v > prev);
      if (next === undefined) {
        return undefined;
      }
      result.push(next);
    }
  }
  return result;
}

export abstract class StyleBuilder {
  protected params: StyleParams;
  protected resolver: DefaultValueResolver;

  constructor(params: StyleParams, deps: BuilderDeps) {
    this.params = params;
    this.resolver = deps.resolver;
  }

  abstract build(): Style;

  protected assertGeometry(...allowed: string[]): void {
    if (!allowed.includes(this.params.geometry_type)) {
      throw new BuilderError(
        `Style type ${this.params.style_type} does not support geometry ${this.params.geometry_type}`
      );
    }
  }

  protected createDefaultRule(symbolizer: Symbolizer, name = 'Default rule'): Rule {
    const rule: Rule = { name, symbolizers: [symbolizer] };
    if (this.params.min_scale) {
      rule.scaleDenominator = { min: this.params.min_scale };
    }
    if (this.params.max_scale) {
      rule.scaleDenominator = { ...(rule.scaleDenominator || {}), max: this.params.max_scale };
    }
    return rule;
  }
}

export class SimpleStyleBuilder extends StyleBuilder {
  build(): Style {
    this.assertGeometry('point', 'line', 'polygon');
    const symbolizer = buildSymbolizerForGeometry(this.params.geometry_type, this.params, this.resolver);
    return {
      name: this.params.style_name,
      rules: [this.createDefaultRule(symbolizer)],
    };
  }
}

export class CategorizedStyleBuilder extends StyleBuilder {
  build(): Style {
    this.assertGeometry('point', 'line', 'polygon');
    if (!this.params.field_name || !this.params.categories?.length) {
      throw new BuilderError('field_name and categories are required for categorized style');
    }

    const fieldName = this.params.field_name;
    const rules: Rule[] = this.params.categories.map((cat) => ({
      name: cat.label || `${fieldName} = ${cat.value}`,
      filter: ['==', fieldName, cat.value] as Filter,
      symbolizers: [buildSymbolizerForGeometry(this.params.geometry_type, { ...this.params, ...cat }, this.resolver)],
    }));

    const notEquals = this.params.categories.map((c) => ['!=', fieldName, c.value] as Filter);
    rules.push({
      name: 'Default',
      filter: (notEquals.length === 1 ? notEquals[0] : ['&&', ...notEquals]) as Filter,
      symbolizers: [buildSymbolizerForGeometry(this.params.geometry_type, this.params, this.resolver)],
    });

    return { name: this.params.style_name, rules };
  }
}

export class ClassifiedStyleBuilder extends StyleBuilder {
  private ruleGenerator?: RuleGenerator;
  private dataSchema?: DataSchema;

  constructor(params: StyleParams, deps: BuilderDeps) {
    super(params, deps);
    this.ruleGenerator = deps.ruleGenerator;
    this.dataSchema = deps.dataSchema;
  }

  build(): Style {
    this.assertGeometry('point', 'line', 'polygon');
    if (!this.params.field_name || !this.params.classes || !this.params.color_ramp?.length) {
      throw new BuilderError('field_name, classes and color_ramp are required for classified style');
    }

    const breaks = this.ruleGenerator?.computeBreaks(
      this.params.field_name,
      this.params.classification_method || 'equalInterval',
      this.params.classes,
      this.dataSchema
    ) || Array.from({ length: this.params.classes + 1 }, (_, i) => i);

    const rules: Rule[] = [];
    for (let i = 0; i < breaks.length - 1; i++) {
      const lower = breaks[i];
      const upper = breaks[i + 1];
      rules.push({
        name: `${lower} - ${upper}`,
        filter: ['&&', ['>=', this.params.field_name, lower], ['<', this.params.field_name, upper]] as Filter,
        symbolizers: [
          buildSymbolizerForGeometry(this.params.geometry_type, {
            ...this.params,
            fill_color: this.params.color_ramp[i % this.params.color_ramp.length],
          }, this.resolver),
        ],
      });
    }

    return { name: this.params.style_name, rules };
  }
}

export class TextStyleBuilder extends StyleBuilder {
  build(): Style {
    this.assertGeometry('point', 'line', 'polygon');
    if (!this.params.label) {
      throw new BuilderError('label is required for text style');
    }

    return {
      name: this.params.style_name,
      rules: [{
        name: 'Label rule',
        symbolizers: [{
          kind: 'Text',
          label: this.params.label,
          font: [this.params.font_family || 'sans-serif'],
          size: this.params.font_size ?? 12,
          color: this.params.stroke_color || '#000000',
          haloColor: this.params.halo_color,
          haloWidth: this.params.halo_radius,
          placement: this.params.placement || 'point',
          offset: this.params.offset,
        } as Symbolizer],
      }],
    };
  }
}

export class StyleBuilderFactory {
  static create(params: StyleParams, deps: BuilderDeps): StyleBuilder {
    switch (params.style_type) {
      case 'simple':
        return new SimpleStyleBuilder(params, deps);
      case 'categorized':
        return new CategorizedStyleBuilder(params, deps);
      case 'classified':
        return new ClassifiedStyleBuilder(params, deps);
      case 'text':
        return new TextStyleBuilder(params, deps);
      default:
        throw new BuilderError(`Unsupported style_type: ${params.style_type}`);
    }
  }
}

export function buildSymbolizerForGeometry(
  geometryType: string,
  params: Partial<StyleParams>,
  resolver: DefaultValueResolver
): Symbolizer {
  switch (geometryType) {
    case 'point':
      return {
        kind: 'Mark',
        wellKnownName: params.well_known_name || 'circle',
        size: params.size ?? (resolver.resolve('Mark', 'size') as number),
        color: params.fill_color || (resolver.resolve('Mark', 'color') as string),
        strokeColor: params.stroke_color,
        strokeWidth: params.stroke_width,
        rotate: params.rotation,
      } as Symbolizer;
    case 'line':
      return {
        kind: 'Line',
        color: params.stroke_color || (resolver.resolve('Line', 'color') as string),
        width: params.stroke_width ?? (resolver.resolve('Line', 'width') as number),
        opacity: params.stroke_opacity ?? params.opacity ?? (resolver.resolve('Line', 'opacity') as number),
        dasharray: params.stroke_dasharray,
        lineCap: params.stroke_linecap,
        lineJoin: params.stroke_linejoin,
      } as Symbolizer;
    case 'polygon':
      return {
        kind: 'Fill',
        color: params.fill_color || (resolver.resolve('Fill', 'color') as string),
        opacity: params.fill_opacity ?? params.opacity ?? (resolver.resolve('Fill', 'opacity') as number),
        outlineColor: params.stroke_color,
        outlineWidth: params.stroke_width,
        outlineOpacity: params.stroke_opacity,
      } as Symbolizer;
    default:
      throw new BuilderError(`Unsupported geometry type: ${geometryType}`);
  }
}
