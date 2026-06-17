import type {
  WellKnownName,
  CapType,
  JoinType,
  FontWeightType,
  FontStyleType,
  AnchorType,
} from 'geostyler-style';
import {
  type SymbolizerNode,
  type SymbolizerKind,
  type SymbolizerNodeData,
  type GeoStylerSymbolizer,
  type Point2D,
  type MarkSymbolizer,
  type LineSymbolizer,
  type FillSymbolizer,
  type TextSymbolizer,
} from './types.js';

function pointToAnchor(anchor: Point2D): AnchorType {
  const x = anchor.x;
  const y = anchor.y;
  if (x === 0.5 && y === 0.5) return 'center';
  if (x === 0.5 && y === 0) return 'bottom';
  if (x === 0.5 && y === 1) return 'top';
  if (x === 0 && y === 0.5) return 'left';
  if (x === 1 && y === 0.5) return 'right';
  if (x === 0 && y === 0) return 'bottom-left';
  if (x === 1 && y === 0) return 'bottom-right';
  if (x === 0 && y === 1) return 'top-left';
  if (x === 1 && y === 1) return 'top-right';
  return 'center';
}

function anchorToPoint(anchor: AnchorType): Point2D {
  switch (anchor) {
    case 'center': return { x: 0.5, y: 0.5 };
    case 'bottom': return { x: 0.5, y: 0 };
    case 'top': return { x: 0.5, y: 1 };
    case 'left': return { x: 0, y: 0.5 };
    case 'right': return { x: 1, y: 0.5 };
    case 'bottom-left': return { x: 0, y: 0 };
    case 'bottom-right': return { x: 1, y: 0 };
    case 'top-left': return { x: 0, y: 1 };
    case 'top-right': return { x: 1, y: 1 };
    default: return { x: 0.5, y: 0.5 };
  }
}

const LINE_STYLE_MAP: Record<string, number[]> = {
  solid: [],
  dashed: [6, 4],
  dotted: [2, 4],
};

export class SymbolizerTransformer {
  static toGeoStyler(kind: SymbolizerKind, data: SymbolizerNodeData): GeoStylerSymbolizer {
    switch (kind) {
      case 'Mark':
        return SymbolizerTransformer.markToGeoStyler(data);
      case 'Line':
        return SymbolizerTransformer.lineToGeoStyler(data);
      case 'Fill':
        return SymbolizerTransformer.fillToGeoStyler(data);
      case 'Text':
        return SymbolizerTransformer.textToGeoStyler(data);
      default:
        throw new Error(`Unknown Symbolizer kind: ${kind}`);
    }
  }

  static fromGeoStyler(symbolizer: GeoStylerSymbolizer): SymbolizerNode {
    const kind = SymbolizerTransformer.inferKind(symbolizer);
    switch (kind) {
      case 'Mark':
        return SymbolizerTransformer.markFromGeoStyler(symbolizer as MarkSymbolizer);
      case 'Line':
        return SymbolizerTransformer.lineFromGeoStyler(symbolizer as LineSymbolizer);
      case 'Fill':
        return SymbolizerTransformer.fillFromGeoStyler(symbolizer as FillSymbolizer);
      case 'Text':
        return SymbolizerTransformer.textFromGeoStyler(symbolizer as TextSymbolizer);
      default:
        throw new Error(`Unknown Symbolizer kind: ${kind}`);
    }
  }

  static createDefault(kind: SymbolizerKind): SymbolizerNode {
    return SymbolizerTransformer.fromGeoStyler(
      SymbolizerTransformer.toGeoStyler(kind, {})
    );
  }

  private static inferKind(symbolizer: GeoStylerSymbolizer): SymbolizerKind {
    if ('wellKnownName' in symbolizer || 'radius' in symbolizer) return 'Mark';
    if ('fillColor' in symbolizer || 'outlineColor' in symbolizer) return 'Fill';
    if ('label' in symbolizer || 'font' in symbolizer) return 'Text';
    return 'Line';
  }

  private static markToGeoStyler(data: SymbolizerNodeData): MarkSymbolizer {
    const sym: MarkSymbolizer = {
      kind: 'Mark',
      wellKnownName: ((data.markWellKnownName as string) || 'circle') as WellKnownName,
    };
    if (data.markRadius !== undefined) sym.radius = data.markRadius as number;
    if (data.markFillColor !== undefined) sym.color = data.markFillColor as string;
    if (data.markFillOpacity !== undefined) sym.fillOpacity = data.markFillOpacity as number;
    if (data.markStrokeColor !== undefined) sym.strokeColor = data.markStrokeColor as string;
    if (data.markStrokeWidth !== undefined) sym.strokeWidth = data.markStrokeWidth as number;
    if (data.markStrokeOpacity !== undefined) sym.strokeOpacity = data.markStrokeOpacity as number;
    if (data.markRotate !== undefined) sym.rotate = data.markRotate as number;
    return sym;
  }

  private static markFromGeoStyler(sym: MarkSymbolizer): SymbolizerNode {
    const data: SymbolizerNodeData = {
      markWellKnownName: sym.wellKnownName || 'circle',
    };
    if (sym.radius !== undefined) data.markRadius = sym.radius;
    if (sym.color !== undefined) data.markFillColor = sym.color;
    if (sym.fillOpacity !== undefined) data.markFillOpacity = sym.fillOpacity;
    if (sym.strokeColor !== undefined) data.markStrokeColor = sym.strokeColor;
    if (sym.strokeWidth !== undefined) data.markStrokeWidth = sym.strokeWidth;
    if (sym.strokeOpacity !== undefined) data.markStrokeOpacity = sym.strokeOpacity;
    if (sym.rotate !== undefined) data.markRotate = sym.rotate;
    return {
      id: `sym_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: 'Symbolizer',
      kind: 'Mark',
      data,
      children: [],
    };
  }

  private static lineToGeoStyler(data: SymbolizerNodeData): LineSymbolizer {
    const sym: LineSymbolizer = {
      kind: 'Line',
    };
    if (data.lineColor !== undefined) sym.color = data.lineColor as string;
    if (data.lineWidth !== undefined) sym.width = data.lineWidth as number;
    if (data.lineOpacity !== undefined) sym.opacity = data.lineOpacity as number;
    if (data.lineDasharray !== undefined) {
      const dash = data.lineDasharray as string | number[];
      if (typeof dash === 'string') {
        sym.dasharray = LINE_STYLE_MAP[dash] || [];
      } else {
        sym.dasharray = dash;
      }
    }
    if (data.lineCap !== undefined) sym.cap = (data.lineCap as string) as CapType;
    if (data.lineJoin !== undefined) sym.join = (data.lineJoin as string) as JoinType;
    return sym;
  }

  private static lineFromGeoStyler(sym: LineSymbolizer): SymbolizerNode {
    const data: SymbolizerNodeData = {};
    if (sym.color !== undefined) data.lineColor = sym.color;
    if (sym.width !== undefined) data.lineWidth = sym.width;
    if (sym.opacity !== undefined) data.lineOpacity = sym.opacity;
    if (sym.dasharray !== undefined) {
      const dash = sym.dasharray;
      if (Array.isArray(dash) && dash.length === 0) {
        data.lineDasharray = 'solid';
      } else if (Array.isArray(dash) && dash.length === 2 && dash[0] === 6 && dash[1] === 4) {
        data.lineDasharray = 'dashed';
      } else if (Array.isArray(dash) && dash.length === 2 && dash[0] === 2 && dash[1] === 4) {
        data.lineDasharray = 'dotted';
      } else {
        data.lineDasharray = dash;
      }
    }
    if (sym.cap !== undefined) data.lineCap = sym.cap;
    if (sym.join !== undefined) data.lineJoin = sym.join;
    return {
      id: `sym_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: 'Symbolizer',
      kind: 'Line',
      data,
      children: [],
    };
  }

  private static fillToGeoStyler(data: SymbolizerNodeData): FillSymbolizer {
    const sym: FillSymbolizer = {
      kind: 'Fill',
    };
    if (data.fillColor !== undefined) sym.color = data.fillColor as string;
    if (data.fillOpacity !== undefined) sym.fillOpacity = data.fillOpacity as number;
    if (data.fillOutlineColor !== undefined) sym.outlineColor = data.fillOutlineColor as string;
    if (data.fillOutlineWidth !== undefined) sym.outlineWidth = data.fillOutlineWidth as number;
    if (data.fillOutlineOpacity !== undefined) sym.outlineOpacity = data.fillOutlineOpacity as number;
    if (data.fillOutlineDasharray !== undefined) sym.outlineDasharray = data.fillOutlineDasharray as number[];
    return sym;
  }

  private static fillFromGeoStyler(sym: FillSymbolizer): SymbolizerNode {
    const data: SymbolizerNodeData = {};
    if (sym.color !== undefined) data.fillColor = sym.color;
    if (sym.fillOpacity !== undefined) data.fillOpacity = sym.fillOpacity;
    if (sym.outlineColor !== undefined) data.fillOutlineColor = sym.outlineColor;
    if (sym.outlineWidth !== undefined) data.fillOutlineWidth = sym.outlineWidth;
    if (sym.outlineOpacity !== undefined) data.fillOutlineOpacity = sym.outlineOpacity;
    if (sym.outlineDasharray !== undefined) data.fillOutlineDasharray = sym.outlineDasharray;
    return {
      id: `sym_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: 'Symbolizer',
      kind: 'Fill',
      data,
      children: [],
    };
  }

  private static textToGeoStyler(data: SymbolizerNodeData): TextSymbolizer {
    const sym: TextSymbolizer = {
      kind: 'Text',
    };
    if (data.textLabel !== undefined) sym.label = data.textLabel as string;
    if (data.textFont !== undefined) sym.font = [data.textFont as string];
    if (data.textSize !== undefined) sym.size = data.textSize as number;
    if (data.textColor !== undefined) sym.color = data.textColor as string;
    if (data.textFontWeight !== undefined) sym.fontWeight = (data.textFontWeight as string) as FontWeightType;
    if (data.textFontStyle !== undefined) sym.fontStyle = (data.textFontStyle as string) as FontStyleType;
    if (data.textAnchor !== undefined) {
      const anchor = data.textAnchor as Point2D;
      sym.anchor = pointToAnchor(anchor);
    }
    if (data.textOffset !== undefined) {
      // GeoStyler v12 TextSymbolizer has no offset field; store as-is for round-trip
      const offset = data.textOffset as Point2D;
      (sym as unknown as Record<string, unknown>).offset = [offset.x, offset.y];
    }
    if (data.textHaloColor !== undefined) sym.haloColor = data.textHaloColor as string;
    if (data.textHaloWidth !== undefined) sym.haloWidth = data.textHaloWidth as number;
    return sym;
  }

  private static textFromGeoStyler(sym: TextSymbolizer): SymbolizerNode {
    const data: SymbolizerNodeData = {};
    if (sym.label !== undefined) data.textLabel = sym.label;
    if (sym.font !== undefined && sym.font.length > 0) data.textFont = sym.font[0];
    if (sym.size !== undefined) data.textSize = sym.size;
    if (sym.color !== undefined) data.textColor = sym.color;
    if (sym.fontWeight !== undefined) data.textFontWeight = sym.fontWeight;
    if (sym.fontStyle !== undefined) data.textFontStyle = sym.fontStyle;
    if (sym.anchor !== undefined) {
      data.textAnchor = anchorToPoint(sym.anchor as AnchorType);
    }
    if (sym.offset !== undefined && Array.isArray(sym.offset) && sym.offset.length >= 2) {
      data.textOffset = { x: sym.offset[0] as number, y: sym.offset[1] as number };
    }
    if (sym.haloColor !== undefined) data.textHaloColor = sym.haloColor;
    if (sym.haloWidth !== undefined) data.textHaloWidth = sym.haloWidth;
    return {
      id: `sym_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: 'Symbolizer',
      kind: 'Text',
      data,
      children: [],
    };
  }
}
