import type { GeoStylerSymbolizer } from '@sldagent/core';

// Inline Rule type to avoid geostyler-style module resolution issues
interface GeoStylerRule {
  name: string;
  symbolizers: GeoStylerSymbolizer[];
  filter?: unknown;
  scaleDenominator?: { min?: number; max?: number };
}

export interface ClassificationOptions {
  attribute: string;
  method: 'equalInterval' | 'quantile' | 'naturalBreaks';
  classes: number;
  colorRamp: string[];
}

export interface GeoStylerData {
  features: Array<{
    properties: Record<string, unknown>;
  }>;
}

export class RuleGenerator {
  /**
   * Generate classification rules based on numeric attribute values.
   * Basic MVP implementation with equalInterval and quantile methods.
   */
  static classify(data: GeoStylerData, options: ClassificationOptions): GeoStylerRule[] {
    const values = data.features
      .map((f) => f.properties[options.attribute])
      .filter((v): v is number => typeof v === 'number');

    if (values.length === 0) {
      return [];
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const colors = RuleGenerator.generateColors(options.colorRamp, options.classes);

    let breaks: number[];

    switch (options.method) {
      case 'equalInterval': {
        const interval = (max - min) / options.classes;
        breaks = [];
        for (let i = 1; i < options.classes; i++) {
          breaks.push(min + interval * i);
        }
        break;
      }
      case 'quantile': {
        const sorted = [...values].sort((a, b) => a - b);
        breaks = [];
        for (let i = 1; i < options.classes; i++) {
          const idx = Math.floor((sorted.length * i) / options.classes);
          breaks.push(sorted[Math.min(idx, sorted.length - 1)]);
        }
        break;
      }
      case 'naturalBreaks': {
        // MVP fallback to equalInterval for naturalBreaks
        const interval = (max - min) / options.classes;
        breaks = [];
        for (let i = 1; i < options.classes; i++) {
          breaks.push(min + interval * i);
        }
        break;
      }
      default: {
        const interval = (max - min) / options.classes;
        breaks = [];
        for (let i = 1; i < options.classes; i++) {
          breaks.push(min + interval * i);
        }
      }
    }

    const rules: GeoStylerRule[] = [];

    for (let i = 0; i < options.classes; i++) {
      const lowerBound = i === 0 ? min : breaks[i - 1];
      const upperBound = i === options.classes - 1 ? max : breaks[i];
      const color = colors[i];

      const filter: unknown = [
        '&&',
        ['>=', options.attribute, lowerBound],
        ['<', options.attribute, upperBound],
      ];

      const symbolizer: GeoStylerSymbolizer = {
        kind: 'Fill',
        color,
        outlineColor: '#333333',
        outlineWidth: 1,
      };

      rules.push({
        name: `${options.attribute}_class_${i + 1}`,
        symbolizers: [symbolizer],
        filter,
      });
    }

    return rules;
  }

  /**
   * Generate unique value (categorization) rules.
   */
  static categorize(data: GeoStylerData, attribute: string, colorRamp: string[]): GeoStylerRule[] {
    const values = data.features
      .map((f) => f.properties[attribute])
      .filter((v): v is string | number => v !== undefined && v !== null);

    const uniqueValues = [...new Set(values)];
    const colors = RuleGenerator.generateColors(colorRamp, uniqueValues.length);

    const rules: GeoStylerRule[] = [];

    for (let i = 0; i < uniqueValues.length; i++) {
      const value = uniqueValues[i];
      const color = colors[i];

      const filter: unknown = ['==', attribute, value];

      const symbolizer: GeoStylerSymbolizer = {
        kind: 'Fill',
        color,
        outlineColor: '#333333',
        outlineWidth: 1,
      };

      rules.push({
        name: `${attribute}_${String(value)}`,
        symbolizers: [symbolizer],
        filter,
      });
    }

    return rules;
  }

  /**
   * Generate a color palette by interpolating a color ramp.
   */
  private static generateColors(ramp: string[], count: number): string[] {
    if (ramp.length === 0) {
      return Array(count).fill('#CCCCCC');
    }

    if (ramp.length >= count) {
      return ramp.slice(0, count);
    }

    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const idx = t * (ramp.length - 1);
      const lowerIdx = Math.floor(idx);
      const upperIdx = Math.ceil(idx);
      const ratio = idx - lowerIdx;

      if (lowerIdx === upperIdx || upperIdx >= ramp.length) {
        colors.push(ramp[lowerIdx] ?? '#CCCCCC');
      } else {
        colors.push(RuleGenerator.interpolateColor(ramp[lowerIdx]!, ramp[upperIdx]!, ratio));
      }
    }

    return colors;
  }

  private static interpolateColor(color1: string, color2: string, ratio: number): string {
    const hexToRgb = (hex: string): [number, number, number] => {
      const clean = hex.replace('#', '');
      const bigint = parseInt(clean, 16);
      return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    };

    const rgbToHex = (r: number, g: number, b: number): string => {
      return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
    };

    const [r1, g1, b1] = hexToRgb(color1);
    const [r2, g2, b2] = hexToRgb(color2);

    const r = r1 + (r2 - r1) * ratio;
    const g = g1 + (g2 - g1) * ratio;
    const b = b1 + (b2 - b1) * ratio;

    return rgbToHex(r, g, b);
  }
}
